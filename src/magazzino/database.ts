// =============================================================================
// magazzino/database.ts — articoli, varianti e movimenti nel database
// =============================================================================
// Solo server. Tabelle coinvolte (vedi prisma/schema.prisma):
//   Articolo            es. "Polo piquet manica corta", categoria "T-shirt e polo"
//   VarianteArticolo    un colore + una taglia di un articolo (es. Nero M)
//   MovimentoMagazzino  +/- pezzi di una variante, con causale, data e utente
// La giacenza di una variante è sempre la SOMMA dei suoi movimenti.
// Il magazzino può andare sotto zero: un ordine non si blocca mai per il magazzino.

import type { Prisma } from "@prisma/client";
import { db, ErroreUtente } from "@/comune/server";
import {
  type ArticoloInput,
  chiaveVariante,
  type MovimentoInput,
  movimentiPerAllineare,
  paroleRicerca,
  pezziDaPrendere,
  tipoArticolo,
} from "./regole";

/** Il "db" dentro una transazione: stessi metodi, ma tutto riesce o fallisce insieme. */
type Tx = Prisma.TransactionClient;

/** Giacenza di ogni variante: Map { varianteId -> pezzi }. */
async function giacenze(tx: Tx | typeof db, varianteIds: string[]) {
  // groupBy + _sum = in SQL "SELECT varianteId, SUM(quantita) ... GROUP BY varianteId".
  const somme = await tx.movimentoMagazzino.groupBy({
    by: ["varianteId"],
    where: { varianteId: { in: varianteIds } },
    _sum: { quantita: true },
  });
  return new Map(somme.map((s) => [s.varianteId, s._sum.quantita ?? 0]));
}

/** Trova la variante (colore + taglia) di un articolo, o la crea se non c'è. */
async function trovaOCreaVariante(tx: Tx, articoloId: string, colore: string, taglia: string) {
  const varianti = await tx.varianteArticolo.findMany({ where: { articoloId } });
  const k = chiaveVariante(colore, taglia);
  const esistente = varianti.find((v) => chiaveVariante(v.colore, v.taglia) === k);
  return (
    esistente ?? tx.varianteArticolo.create({ data: { articoloId, colore: colore.trim(), taglia: taglia.trim() } })
  );
}

// -----------------------------------------------------------------------------
// Collegamento con gli ordini
// -----------------------------------------------------------------------------

/**
 * Porta i pezzi presi dal magazzino da una riga d'ordine a quelli giusti per il suo stato
 * (vedi pezziDaPrendere in magazzino/regole.ts). Si chiama dopo ogni cambio di stato o
 * modifica della riga (da ordini/database.ts), dentro la stessa transazione.
 * Se la riga cambia articolo, i pezzi del vecchio articolo rientrano.
 */
export async function allineaRigaAlMagazzino(
  tx: Tx,
  rigaId: string,
  utenteId: string | null,
  opzioni: { rimetti?: boolean } = {},
) {
  const riga = await tx.rigaOrdine.findUniqueOrThrow({ where: { id: rigaId }, include: { varianti: true } });
  const movimenti = await tx.movimentoMagazzino.findMany({ where: { rigaId }, include: { variante: true } });
  if (!riga.articoloId && movimenti.length === 0) return; // prodotto scritto a mano: niente magazzino

  // Pezzi già presi, per variante del magazzino (id). I movimenti in uscita sono
  // negativi, quindi "presi" = meno la loro somma.
  const presiPerId = new Map<string, number>();
  for (const m of movimenti) presiPerId.set(m.varianteId, (presiPerId.get(m.varianteId) ?? 0) - m.quantita);

  // Quello che appartiene all'articolo attuale si confronta per colore|taglia...
  const presiArticolo = new Map<string, number>();
  const idPerChiave = new Map<string, string>();
  for (const m of movimenti) {
    if (m.variante.articoloId !== riga.articoloId) continue;
    const k = chiaveVariante(m.variante.colore, m.variante.taglia);
    idPerChiave.set(k, m.varianteId);
    presiArticolo.set(k, presiPerId.get(m.varianteId) ?? 0);
  }
  const daPrendere = riga.articoloId
    ? pezziDaPrendere(riga.stato, riga.varianti, presiArticolo, opzioni.rimetti ?? true)
    : new Map<string, number>();

  for (const { chiave, quantita } of movimentiPerAllineare(presiArticolo, daPrendere)) {
    let varianteId = idPerChiave.get(chiave);
    if (!varianteId) {
      // Colore/taglia mai usati da questa riga: si cerca (o si crea) la variante del magazzino.
      const v = riga.varianti.find((x) => chiaveVariante(x.colore, x.taglia) === chiave)!;
      varianteId = (await trovaOCreaVariante(tx, riga.articoloId!, v.colore, v.taglia)).id;
    }
    await tx.movimentoMagazzino.create({
      data: { varianteId, quantita, causale: quantita < 0 ? "LAVORAZIONE" : "RIENTRO", rigaId, utenteId },
    });
  }

  // ...quello di un articolo vecchio (la riga ha cambiato articolo) rientra tutto.
  for (const m of movimenti) {
    if (m.variante.articoloId === riga.articoloId) continue;
    const presi = presiPerId.get(m.varianteId) ?? 0;
    if (presi === 0) continue;
    presiPerId.set(m.varianteId, 0); // per non farlo rientrare due volte (più movimenti sulla stessa variante)
    await tx.movimentoMagazzino.create({
      data: { varianteId: m.varianteId, quantita: presi, causale: "RIENTRO", rigaId, utenteId },
    });
  }
}

// -----------------------------------------------------------------------------
// Articoli
// -----------------------------------------------------------------------------

/** Articoli con le varianti e la giacenza di ognuna (pagina Magazzino). */
export async function elencoArticoli(opzioni: { cerca?: string; categoria?: string } = {}) {
  // Ogni parola cercata deve comparire nel nome, nella categoria o in un colore ("polo nera").
  const parole = paroleRicerca(opzioni.cerca ?? "");
  const articoli = await db.articolo.findMany({
    where: {
      archiviato: false,
      ...(opzioni.categoria ? { categoria: opzioni.categoria } : {}),
      AND: parole.map((p) => ({
        OR: [
          { nome: { contains: p, mode: "insensitive" as const } },
          { categoria: { contains: p, mode: "insensitive" as const } },
          { varianti: { some: { colore: { contains: p, mode: "insensitive" as const } } } },
        ],
      })),
    },
    orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    include: { varianti: { orderBy: { id: "asc" } } },
  });
  // Una sola query per le giacenze di tutte le varianti di tutti gli articoli.
  const g = await giacenze(
    db,
    articoli.flatMap((a) => a.varianti.map((v) => v.id)),
  );
  return articoli.map((a) => {
    const varianti = a.varianti.map((v) => ({ ...v, giacenza: g.get(v.id) ?? 0 }));
    return { ...a, varianti, totale: varianti.reduce((s, v) => s + v.giacenza, 0) };
  });
}

/** Le categorie usate (per i filtri della pagina Magazzino e i suggerimenti del modulo). */
export async function categorieArticoli() {
  const r = await db.articolo.findMany({
    where: { archiviato: false, categoria: { not: null } },
    distinct: ["categoria"], // ogni categoria una volta sola
    select: { categoria: true },
    orderBy: { categoria: "asc" },
  });
  return r.map((x) => x.categoria!);
}

/** Un articolo con varianti, giacenze e gli ultimi 40 movimenti (pagina dell'articolo). */
export async function leggiArticolo(id: string) {
  const a = await db.articolo.findUnique({ where: { id }, include: { varianti: { orderBy: { id: "asc" } } } });
  if (!a) return null;
  const g = await giacenze(
    db,
    a.varianti.map((v) => v.id),
  );
  const movimenti = await db.movimentoMagazzino.findMany({
    where: { variante: { articoloId: id } },
    orderBy: { data: "desc" },
    take: 40,
    include: {
      variante: true,
      utente: { select: { name: true } },
      // Se il movimento viene da un ordine: numero dell'ordine e nome del cliente, per il link.
      riga: {
        select: {
          ordine: { select: { id: true, anno: true, progressivo: true, cliente: { select: { nome: true } } } },
        },
      },
    },
  });
  const varianti = a.varianti.map((v) => ({ ...v, giacenza: g.get(v.id) ?? 0 }));
  return { ...a, varianti, totale: varianti.reduce((s, v) => s + v.giacenza, 0), movimenti };
}

/** Tipo più usato tra gli altri articoli della stessa categoria (null se la categoria è nuova). */
async function tipoDellaCategoria(categoria: string | null, escludiId?: string) {
  if (!categoria) return null;
  const r = await db.articolo.groupBy({
    by: ["tipo"],
    where: { categoria: { equals: categoria, mode: "insensitive" }, ...(escludiId ? { id: { not: escludiId } } : {}) },
    _count: { _all: true },
    orderBy: { _count: { tipo: "desc" } },
    take: 1,
  });
  return r[0]?.tipo ?? null;
}

/** Nuovo articolo: il tipo (abbigliamento, gadget...) si deduce, vedi tipoArticolo. */
export async function creaArticolo(dati: ArticoloInput) {
  const tipo = tipoArticolo(dati.categoria, dati.nome, await tipoDellaCategoria(dati.categoria));
  return db.articolo.create({ data: { ...dati, tipo } });
}

/** Modifica di nome, categoria o note. */
export async function aggiornaArticolo(id: string, dati: ArticoloInput) {
  const prima = await db.articolo.findUniqueOrThrow({ where: { id } });
  // Il tipo si ricalcola solo se cambia la categoria.
  const tipo =
    (prima.categoria ?? "").toLowerCase() === (dati.categoria ?? "").toLowerCase()
      ? prima.tipo
      : tipoArticolo(dati.categoria, dati.nome, await tipoDellaCategoria(dati.categoria, id));
  return db.articolo.update({ where: { id }, data: { ...dati, tipo } });
}

/** Archiviare: l'articolo sparisce dal magazzino, ma i movimenti e gli ordini restano. */
export async function impostaArticoloArchiviato(id: string, archiviato: boolean) {
  await db.articolo.update({ where: { id }, data: { archiviato } });
}

// -----------------------------------------------------------------------------
// Movimenti scritti a mano
// -----------------------------------------------------------------------------

/** "Arrivata merce": aggiunge pezzi a una variante (la crea se è un colore/taglia nuovo). */
export async function registraArrivo(articoloId: string, dati: MovimentoInput, utenteId: string) {
  if (dati.quantita <= 0) throw new ErroreUtente("Scrivi quanti pezzi sono arrivati");
  return db.$transaction(async (tx) => {
    const v = await trovaOCreaVariante(tx, articoloId, dati.colore, dati.taglia);
    return tx.movimentoMagazzino.create({
      data: { varianteId: v.id, quantita: dati.quantita, causale: "ARRIVO", note: dati.note, utenteId },
    });
  });
}

/** "Correggi quantità": dopo un conteggio, si scrive quanti pezzi ci sono davvero. */
export async function correggiGiacenza(articoloId: string, dati: MovimentoInput, utenteId: string) {
  if (dati.quantita < 0) throw new ErroreUtente("I pezzi contati non possono essere negativi");
  return db.$transaction(async (tx) => {
    const v = await trovaOCreaVariante(tx, articoloId, dati.colore, dati.taglia);
    const attuale = (await giacenze(tx, [v.id])).get(v.id) ?? 0;
    // Si salva la differenza (es. ne risultano 20, ne conto 17: movimento -3).
    const delta = dati.quantita - attuale;
    if (delta === 0) return null; // era già giusto
    return tx.movimentoMagazzino.create({
      data: { varianteId: v.id, quantita: delta, causale: "CORREZIONE", note: dati.note, utenteId },
    });
  });
}

// -----------------------------------------------------------------------------
// Per il modulo del prodotto (ordini)
// -----------------------------------------------------------------------------

/** Dati leggeri per scegliere l'articolo nel modulo del prodotto: vanno al browser, meglio pochi. */
export async function articoliPerScelta() {
  const articoli = await elencoArticoli();
  return articoli.map((a) => ({
    id: a.id,
    nome: a.nome,
    categoria: a.categoria,
    tipo: a.tipo,
    varianti: a.varianti.map((v) => ({ colore: v.colore, taglia: v.taglia, giacenza: v.giacenza })),
  }));
}

/** Il tipo di un elemento restituito da articoliPerScelta (lo usa il modulo del prodotto). */
export type ArticoloPerScelta = Awaited<ReturnType<typeof articoliPerScelta>>[number];
