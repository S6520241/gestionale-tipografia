// =============================================================================
// ordini/database.ts — ordini, prodotti, bozze, consegne e pagamenti nel database
// =============================================================================
// Qui stanno tutte le regole che il database da solo non controlla.
// Le pagine leggono con queste funzioni e le azioni (ordini/azioni.ts) scrivono
// SOLO tramite queste funzioni: così le regole sono in un posto solo e si
// possono testare (tests/database.test.ts).
//
// Parole usate nel codice: un ordine ha delle "righe" (i prodotti); ogni riga
// ha delle "varianti" (colore/taglia/quantità) e delle "applicazioni" (stampa,
// ricamo...).

import type { Prisma, StatoRiga } from "@prisma/client";
import { daGiornoISO, oggiISO } from "@/comune/regole";
import { db, ErroreUtente } from "@/comune/server";
import { allineaRigaAlMagazzino } from "@/magazzino/database";
import { quantitaRiga, riepilogoPezzi, statoOrdine, statoPagamento, statoRigaMostrato, totaleOrdine } from "./calcoli";
import type { ConsegnaInput, OrdineInput, PagamentoInput, RigaInput } from "./regole";

/** Il "db" dentro una transazione (db.$transaction(async (tx) => ...)): stesse funzioni, tutto o niente. */
type Tx = Prisma.TransactionClient;

// Cosa leggere di una riga per calcolarne le quantità (vedi quantitaRiga in calcoli.ts).
// "satisfies" controlla che l'oggetto sia un include valido senza cambiarne il tipo.
const includeQuantita = {
  varianti: { select: { quantita: true } },
  consegne: { select: { quantita: true, consegna: { select: { annullata: true } } } },
} satisfies Prisma.RigaOrdineInclude;

/**
 * Prende il prossimo numero dell'anno (1, 2, 3...), senza mai ripeterne uno.
 *
 * Perché SQL "a mano" e non db.contatore.upsert? L'upsert di Prisma a volte fa
 * prima una lettura e poi una scrittura, separate: due persone che creano un
 * ordine nello stesso istante leggerebbero lo stesso numero.
 * INSERT ... ON CONFLICT ... DO UPDATE è un'unica istruzione: Postgres blocca
 * la riga dell'anno finché la transazione non finisce. Funziona anche il
 * 1° gennaio, quando la riga dell'anno nuovo non esiste ancora.
 *
 * Va chiamata DENTRO la transazione che crea l'ordine: se la creazione fallisce,
 * anche l'aumento del contatore viene annullato (niente buchi nella numerazione).
 * (Esportata solo per il test che prova 20 ordini creati nello stesso istante.)
 */
export async function prossimoProgressivo(tx: Tx, anno: number): Promise<number> {
  const righe = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO "Contatore" (anno, ultimo) VALUES (${anno}, 1)
    ON CONFLICT (anno) DO UPDATE SET ultimo = "Contatore".ultimo + 1
    RETURNING ultimo`;
  return righe[0].ultimo;
}

/**
 * Blocca l'ordine fino alla fine della transazione (SELECT ... FOR UPDATE).
 * Serve quando si controlla una quantità e poi si scrive: senza blocco, due
 * persone che registrano una consegna nello stesso momento potrebbero entrambe
 * superare il controllo e consegnare più pezzi di quelli pronti.
 */
async function bloccaOrdine(tx: Tx, ordineId: string) {
  const r = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Ordine" WHERE id = ${ordineId} FOR UPDATE`;
  if (r.length === 0) throw new ErroreUtente("Ordine non trovato");
}

/**
 * Cambia lo stato di una riga e scrive lo storico (chi, quando, da -> a).
 * Poi allinea il magazzino: "In lavorazione" scala i pezzi, tornare indietro li rimette
 * (per "annullata" decide opzioni.rimetti, che si chiede all'utente).
 */
async function scriviStato(
  tx: Tx,
  rigaId: string,
  da: StatoRiga,
  a: StatoRiga,
  utenteId: string,
  opzioni: { rimetti?: boolean } = {},
) {
  if (da === a) return;
  await tx.rigaOrdine.update({ where: { id: rigaId }, data: { stato: a } });
  await tx.storicoStatoRiga.create({ data: { rigaId, da, a, utenteId } });
  await allineaRigaAlMagazzino(tx, rigaId, utenteId, opzioni);
}

// =============================================================================
// ORDINI
// =============================================================================

export async function creaOrdine(dati: OrdineInput, utenteId: string) {
  return db.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({ where: { id: dati.clienteId } });
    if (!cliente || cliente.archiviato) throw new ErroreUtente("Cliente non valido");

    // L'anno del numero è quello italiano (alle 00:30 del 1° gennaio è già l'anno nuovo).
    const anno = Number(oggiISO().slice(0, 4));
    const progressivo = await prossimoProgressivo(tx, anno);

    return tx.ordine.create({
      data: {
        anno,
        progressivo,
        clienteId: dati.clienteId,
        dataConsegna: dati.dataConsegna ? daGiornoISO(dati.dataConsegna) : null,
        urgente: dati.urgente,
        note: dati.note,
        creatoDaId: utenteId,
      },
    });
  });
}

export async function aggiornaOrdine(id: string, dati: OrdineInput) {
  const cliente = await db.cliente.findUnique({ where: { id: dati.clienteId } });
  if (!cliente) throw new ErroreUtente("Cliente non valido");
  return db.ordine.update({
    where: { id },
    data: {
      clienteId: dati.clienteId,
      dataConsegna: dati.dataConsegna ? daGiornoISO(dati.dataConsegna) : null,
      urgente: dati.urgente,
      note: dati.note,
    },
  });
}

/** Archiviare = nascondere (ordini di prova o inseriti per errore). Non è annullare. */
export async function impostaOrdineArchiviato(id: string, archiviato: boolean) {
  return db.ordine.update({ where: { id }, data: { archiviato } });
}

/**
 * Annullare l'ordine = annullare tutte le sue righe, nella stessa transazione.
 * Non esiste un campo "annullato" sull'ordine: il suo stato si calcola dalle righe.
 */
export async function annullaOrdine(id: string, utenteId: string, opzioni: { rimetti?: boolean } = {}) {
  await db.$transaction(async (tx) => {
    await bloccaOrdine(tx, id);
    const righe = await tx.rigaOrdine.findMany({ where: { ordineId: id, stato: { not: "ANNULLATA" } } });
    for (const r of righe) await scriviStato(tx, r.id, r.stato, "ANNULLATA", utenteId, opzioni);
  });
}

/** Ordine completo per la sua pagina, con quantità, stati e soldi già calcolati. */
export async function leggiOrdine(id: string) {
  const ordine = await db.ordine.findUnique({
    where: { id },
    include: {
      cliente: true,
      creatoDa: { select: { name: true, email: true } },
      righe: {
        orderBy: [{ posizione: "asc" }, { creatoIl: "asc" }],
        include: {
          varianti: { orderBy: { id: "asc" } }, // ordine di inserimento (gli id "cuid" crescono nel tempo)
          applicazioni: { orderBy: { id: "asc" } },
          bozze: { orderBy: { creataIl: "desc" }, include: { confermataDa: { select: { name: true } } } },
          storicoStati: { orderBy: { data: "desc" }, include: { utente: { select: { name: true } } } },
          consegne: { select: { quantita: true, consegna: { select: { annullata: true } } } },
          articolo: { select: { id: true, nome: true } },
          movimentiMagazzino: { select: { quantita: true } },
        },
      },
      consegne: {
        orderBy: { data: "desc" },
        include: {
          utente: { select: { name: true } },
          righe: { include: { riga: { select: { descrizione: true } } } },
        },
      },
      pagamenti: { orderBy: { data: "desc" }, include: { utente: { select: { name: true } } } },
    },
  });
  if (!ordine) return null;

  const righe = ordine.righe.map((r) => {
    const q = quantitaRiga(r);
    // Pezzi presi dal magazzino da questa riga (i movimenti in uscita sono negativi, da qui il "-").
    const pezziPresi = -r.movimentiMagazzino.reduce((t, m) => t + m.quantita, 0);
    return { ...r, ...q, statoMostrato: statoRigaMostrato(q), pezziPresi };
  });
  const totale = totaleOrdine(righe);
  return {
    ...ordine,
    righe,
    stato: statoOrdine(righe),
    pezzi: riepilogoPezzi(righe),
    totale,
    pagamento: statoPagamento(totale?.daIncassare ?? null, ordine.pagamenti),
  };
}

// Tipi ricavati dal risultato della funzione: se si aggiunge un campo sopra, si aggiornano da soli.
export type OrdineDettaglio = NonNullable<Awaited<ReturnType<typeof leggiOrdine>>>;
export type RigaDettaglio = OrdineDettaglio["righe"][number];

/**
 * Elenco ordini con stato calcolato.
 * Lo stato non è una colonna, quindi i filtri per stato si fanno in TypeScript
 * (nelle pagine). Per i numeri di una tipografia (centinaia di ordini l'anno)
 * va benissimo; se un giorno diventasse lento, si sposta il calcolo in SQL.
 */
export async function elencoOrdini(opzioni: { archiviati?: boolean; clienteId?: string; cerca?: string } = {}) {
  const cerca = opzioni.cerca?.trim() ?? "";
  // "2026-15" o "15" -> cerca per numero; altrimenti per nome del cliente.
  const numero = cerca.match(/^(?:(\d{4})-)?0*(\d+)$/);

  const ordini = await db.ordine.findMany({
    where: {
      archiviato: opzioni.archiviati ?? false,
      ...(opzioni.clienteId ? { clienteId: opzioni.clienteId } : {}),
      ...(numero
        ? { progressivo: Number(numero[2]), ...(numero[1] ? { anno: Number(numero[1]) } : {}) }
        : cerca
          ? { cliente: { nome: { contains: cerca, mode: "insensitive" } } }
          : {}),
    },
    // Prima le scadenze più vicine; quelli senza data in fondo.
    orderBy: [{ dataConsegna: { sort: "asc", nulls: "last" } }, { anno: "desc" }, { progressivo: "desc" }],
    include: {
      cliente: { select: { id: true, nome: true } },
      righe: { select: { stato: true, quantitaPronta: true, prezzoUnitario: true, ...includeQuantita } },
      pagamenti: { select: { tipo: true, importo: true, annullato: true } },
    },
  });

  return ordini.map(({ righe, pagamenti, ...o }) => {
    const q = righe.map((r) => ({ ...r, ...quantitaRiga(r) }));
    const totale = totaleOrdine(q);
    return {
      ...o,
      numRighe: righe.length,
      stato: statoOrdine(q),
      pezzi: riepilogoPezzi(q),
      pagamento: statoPagamento(totale?.daIncassare ?? null, pagamenti),
    };
  });
}

export type OrdineInElenco = Awaited<ReturnType<typeof elencoOrdini>>[number];

// =============================================================================
// RIGHE (i prodotti dell'ordine)
// =============================================================================

/** Varianti e applicazioni da creare insieme alla riga. */
function datiFigliRiga(dati: RigaInput) {
  return {
    varianti: { create: dati.varianti },
    applicazioni: {
      create: dati.applicazioni.map((a) => ({
        tecnica: a.tecnica,
        posizione: a.posizione,
        // In un campo Json Prisma non accetta null "nudo": undefined = colonna vuota (NULL).
        parametri: a.parametri ?? undefined,
        note: a.note,
      })),
    },
  };
}

export async function aggiungiRiga(ordineId: string, dati: RigaInput) {
  return db.$transaction(async (tx) => {
    await bloccaOrdine(tx, ordineId);
    // La nuova riga va in fondo: posizione = ultima + 1.
    const ultima = await tx.rigaOrdine.aggregate({ where: { ordineId }, _max: { posizione: true } });
    return tx.rigaOrdine.create({
      data: {
        ordineId,
        posizione: (ultima._max.posizione ?? -1) + 1,
        descrizione: dati.descrizione,
        tipo: dati.tipo,
        prezzoUnitario: dati.prezzoUnitario,
        note: dati.note,
        articoloId: dati.articoloId,
        ...datiFigliRiga(dati),
      },
    });
  });
}

/**
 * Modifica una riga: varianti e applicazioni si cancellano e si ricreano.
 * Il nuovo totale non può scendere sotto i pezzi già pronti o consegnati.
 */
export async function modificaRiga(rigaId: string, dati: RigaInput) {
  return db.$transaction(async (tx) => {
    const riga = await tx.rigaOrdine.findUnique({ where: { id: rigaId }, include: includeQuantita });
    if (!riga) throw new ErroreUtente("Riga non trovata");
    await bloccaOrdine(tx, riga.ordineId);

    const nuovoTotale = dati.varianti.reduce((s, v) => s + v.quantita, 0);
    const { quantitaConsegnata } = quantitaRiga(riga);
    if (nuovoTotale < quantitaConsegnata) {
      throw new ErroreUtente(
        `Sono già stati consegnati ${quantitaConsegnata} pezzi: il totale non può essere ${nuovoTotale}.`,
      );
    }
    if (nuovoTotale < riga.quantitaPronta) {
      throw new ErroreUtente(`Ci sono già ${riga.quantitaPronta} pezzi pronti: correggi prima la quantità pronta.`);
    }

    await tx.rigaVariante.deleteMany({ where: { rigaId } });
    await tx.applicazione.deleteMany({ where: { rigaId } });
    const aggiornata = await tx.rigaOrdine.update({
      where: { id: rigaId },
      data: {
        descrizione: dati.descrizione,
        tipo: dati.tipo,
        prezzoUnitario: dati.prezzoUnitario,
        note: dati.note,
        articoloId: dati.articoloId,
        ...datiFigliRiga(dati),
      },
    });
    // Se è già in lavorazione e cambiano quantità o articolo, il magazzino si aggiorna.
    // (per una riga annullata i pezzi restano come erano)
    await allineaRigaAlMagazzino(tx, rigaId, null, { rimetti: false });
    return aggiornata;
  });
}

/**
 * Si cancella davvero solo una riga appena inserita per errore.
 * Se ha storico, bozze o consegne, la si ANNULLA (così la storia resta).
 */
export async function eliminaRiga(rigaId: string) {
  const riga = await db.rigaOrdine.findUnique({
    where: { id: rigaId },
    include: { _count: { select: { storicoStati: true, bozze: true, consegne: true } } },
  });
  if (!riga) throw new ErroreUtente("Riga non trovata");
  const { storicoStati, bozze, consegne } = riga._count;
  if (storicoStati + bozze + consegne > 0) {
    throw new ErroreUtente(
      'Questa riga ha già una storia (stati, bozze o consegne): usa "Annullata" invece di eliminarla.',
    );
  }
  await db.rigaOrdine.delete({ where: { id: rigaId } });
  return riga.ordineId;
}

/** Cambia lo stato di una riga. Si può passare da qualsiasi stato a qualsiasi altro (scelta di progetto). */
export async function cambiaStatoRiga(
  rigaId: string,
  stato: StatoRiga,
  utenteId: string,
  opzioni: { rimetti?: boolean } = {},
) {
  await db.$transaction(async (tx) => {
    const riga = await tx.rigaOrdine.findUnique({ where: { id: rigaId } });
    if (!riga) throw new ErroreUtente("Riga non trovata");
    await scriviStato(tx, rigaId, riga.stato, stato, utenteId, opzioni);
  });
}

/** Quanti pezzi della riga sono pronti: tra quelli già consegnati e il totale. */
export async function impostaQuantitaPronta(rigaId: string, quantitaPronta: number) {
  await db.$transaction(async (tx) => {
    const r = await tx.rigaOrdine.findUnique({ where: { id: rigaId }, select: { ordineId: true } });
    if (!r) throw new ErroreUtente("Riga non trovata");
    await bloccaOrdine(tx, r.ordineId);

    // Si rilegge DOPO il blocco, così i numeri sono quelli aggiornati.
    const riga = await tx.rigaOrdine.findUniqueOrThrow({ where: { id: rigaId }, include: includeQuantita });
    const q = quantitaRiga(riga);
    if (riga.stato === "ANNULLATA") throw new ErroreUtente("La riga è annullata");
    if (quantitaPronta > q.quantitaTotale) {
      throw new ErroreUtente(`I pezzi pronti non possono essere più del totale (${q.quantitaTotale}).`);
    }
    if (quantitaPronta < q.quantitaConsegnata) {
      throw new ErroreUtente(
        `Sono già stati consegnati ${q.quantitaConsegnata} pezzi: i pronti non possono essere meno.`,
      );
    }
    await tx.rigaOrdine.update({ where: { id: rigaId }, data: { quantitaPronta } });
  });
}

// =============================================================================
// BOZZE: la prova che il cliente ha visto e approvato la grafica
// =============================================================================

// Da quali stati si "avanza" quando si registra una bozza (da quelli dopo, lo stato non torna indietro).
const PRIMA_DI_INVIATA: StatoRiga[] = ["DA_FARE"];
const PRIMA_DI_CONFERMATA: StatoRiga[] = ["DA_FARE", "BOZZA_INVIATA"];

export async function registraBozzaInviata(rigaId: string, utenteId: string) {
  await db.$transaction(async (tx) => {
    const riga = await tx.rigaOrdine.findUnique({ where: { id: rigaId } });
    if (!riga) throw new ErroreUtente("Riga non trovata");
    await tx.bozza.create({ data: { rigaId, inviataIl: new Date() } });
    if (PRIMA_DI_INVIATA.includes(riga.stato)) await scriviStato(tx, rigaId, riga.stato, "BOZZA_INVIATA", utenteId);
  });
}

/**
 * Conferma l'ultima bozza non ancora confermata; se non ce n'è (il cliente ha
 * visto il file in negozio, senza invio) ne crea una già confermata.
 */
export async function confermaBozza(
  rigaId: string,
  dati: { modalita: "IN_SEDE" | "A_DISTANZA"; note: string | null },
  utenteId: string,
) {
  await db.$transaction(async (tx) => {
    const riga = await tx.rigaOrdine.findUnique({ where: { id: rigaId } });
    if (!riga) throw new ErroreUtente("Riga non trovata");
    const conferma = { confermataIl: new Date(), confermataDaId: utenteId, modalita: dati.modalita, note: dati.note };

    const aperta = await tx.bozza.findFirst({
      where: { rigaId, confermataIl: null },
      orderBy: { creataIl: "desc" },
    });
    if (aperta) await tx.bozza.update({ where: { id: aperta.id }, data: conferma });
    else await tx.bozza.create({ data: { rigaId, ...conferma } });

    if (PRIMA_DI_CONFERMATA.includes(riga.stato)) {
      await scriviStato(tx, rigaId, riga.stato, "BOZZA_CONFERMATA", utenteId);
    }
  });
}

// =============================================================================
// CONSEGNE (anche di una parte dei pezzi)
// =============================================================================

/**
 * Regole:
 *  - ogni riga deve appartenere a QUESTO ordine;
 *  - non si consegna una riga annullata;
 *  - si consegnano solo pezzi pronti: già consegnati + nuovi <= pronti.
 */
export async function registraConsegna(ordineId: string, dati: ConsegnaInput, utenteId: string) {
  return db.$transaction(async (tx) => {
    await bloccaOrdine(tx, ordineId);
    const righe = await tx.rigaOrdine.findMany({ where: { ordineId }, include: includeQuantita });
    const perId = new Map(righe.map((r) => [r.id, r]));

    for (const voce of dati.righe) {
      const riga = perId.get(voce.rigaId);
      if (!riga) throw new ErroreUtente("Una delle righe non appartiene a questo ordine");
      if (riga.stato === "ANNULLATA") throw new ErroreUtente(`"${riga.descrizione}" è annullata`);
      const q = quantitaRiga(riga);
      const disponibili = q.quantitaPronta - q.quantitaConsegnata;
      if (voce.quantita > disponibili) {
        throw new ErroreUtente(
          `"${riga.descrizione}": puoi consegnare al massimo ${disponibili} pezzi (pronti ${q.quantitaPronta}, già consegnati ${q.quantitaConsegnata}).`,
        );
      }
    }

    return tx.consegna.create({
      data: {
        ordineId,
        utenteId,
        note: dati.note,
        righe: { create: dati.righe.map((r) => ({ rigaId: r.rigaId, quantita: r.quantita })) },
      },
    });
  });
}

/** Una consegna sbagliata non si cancella: si annulla (e resta nello storico). */
export async function annullaConsegna(consegnaId: string) {
  const c = await db.consegna.update({ where: { id: consegnaId }, data: { annullata: true } });
  return c.ordineId;
}

// =============================================================================
// PAGAMENTI
// =============================================================================

/** Registra un acconto o il saldo. Non si incassa su un ordine già pagato del tutto. */
export async function registraPagamento(ordineId: string, dati: PagamentoInput, utenteId: string) {
  return db.$transaction(async (tx) => {
    await bloccaOrdine(tx, ordineId);
    const pagamenti = await tx.pagamento.findMany({ where: { ordineId } });
    if (pagamenti.some((p) => !p.annullato && p.tipo === "SALDO")) {
      throw new ErroreUtente("Questo ordine risulta già pagato. Annulla prima il pagamento sbagliato.");
    }
    return tx.pagamento.create({
      data: { ordineId, utenteId, tipo: dati.tipo, importo: dati.importo, note: dati.note },
    });
  });
}

/** Come le consegne: un pagamento sbagliato non si cancella, si annulla. */
export async function annullaPagamento(pagamentoId: string) {
  const p = await db.pagamento.update({ where: { id: pagamentoId }, data: { annullato: true } });
  return p.ordineId;
}
