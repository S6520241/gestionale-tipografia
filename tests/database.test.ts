// =============================================================================
// tests/database.test.ts — test con un vero PostgreSQL
// =============================================================================
// Verificano le regole che stanno nel database e nelle transazioni:
// numerazione degli ordini, consegne, annullamenti, magazzino, utenti e inviti.
//
// Questi test CANCELLANO tutti i dati prima di ogni prova, quindi usano un
// database separato (TEST_DATABASE_URL nel file .env, vedi tests/setup.ts).
// Senza TEST_DATABASE_URL vengono saltati.
//   Prima volta:  npm run test:db   (crea il database di test vuoto)
//   Poi:          npm test

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/comune/server";
import { correggiGiacenza, leggiArticolo, registraArrivo } from "@/magazzino/database";
import {
  aggiungiRiga,
  annullaConsegna,
  annullaOrdine,
  annullaPagamento,
  cambiaStatoRiga,
  confermaBozza,
  creaOrdine,
  eliminaRiga,
  impostaQuantitaPronta,
  leggiOrdine,
  modificaRiga,
  prossimoProgressivo,
  registraConsegna,
  registraPagamento,
} from "@/ordini/database";
import {
  annullaCodiceInvito,
  cambiaPassword,
  creaCodiceInvito,
  impostaPasswordTemporanea,
  impostaUtenteAttivo,
  registra,
  verificaCredenziali,
} from "@/utenti/database";

// -----------------------------------------------------------------------------
// Aiuti comuni
// -----------------------------------------------------------------------------

const haDbTest = !!process.env.TEST_DATABASE_URL;

/** Svuota tutte le tabelle del database di TEST (mai quello vero, vedi tests/setup.ts). */
async function svuotaDb() {
  if (!haDbTest) throw new Error("Solo sul database di test!");
  await db.$executeRawUnsafe(`
    TRUNCATE "CodiceInvito", "MovimentoMagazzino", "VarianteArticolo", "Articolo", "Pagamento", "ConsegnaRiga", "Consegna", "StoricoStatoRiga", "Bozza", "Applicazione",
      "RigaVariante", "RigaOrdine", "Ordine", "Contatore", "VersioneGrafica", "Grafica",
      "Cliente", "utente" CASCADE`);
}

/** Un utente e un cliente da usare negli ordini di prova. */
async function creaUtenteECliente() {
  const utente = await db.user.create({ data: { email: `test-${Date.now()}@test.it`, name: "Test" } });
  const cliente = await db.cliente.create({ data: { nome: "Cliente test" } });
  return { utente, cliente };
}

// Alla fine di tutte le prove si chiude la connessione al database.
afterAll(() => db.$disconnect());

// =============================================================================
// Ordini (ordini/database.ts)
// =============================================================================

const rigaMagliette = {
  descrizione: "Magliette",
  tipo: "ABBIGLIAMENTO" as const,
  articoloId: null,
  prezzoUnitario: null,
  note: null,
  varianti: [
    { colore: "Nero", taglia: "M", quantita: 30 },
    { colore: "Nero", taglia: "L", quantita: 20 },
  ],
  applicazioni: [],
};

describe.skipIf(!haDbTest)("ordini sul database", () => {
  let utenteId: string;
  let clienteId: string;

  beforeEach(async () => {
    await svuotaDb();
    const { utente, cliente } = await creaUtenteECliente();
    utenteId = utente.id;
    clienteId = cliente.id;
  });

  async function nuovoOrdineConRiga() {
    const ordine = await creaOrdine({ clienteId, dataConsegna: "2026-12-01", urgente: false, note: null }, utenteId);
    const riga = await aggiungiRiga(ordine.id, rigaMagliette);
    return { ordine, riga };
  }

  it("contatore: 20 numeri chiesti in parallelo sono 1..20, senza buchi né doppioni", async () => {
    const numeri = await Promise.all(
      Array.from({ length: 20 }, () => db.$transaction((tx) => prossimoProgressivo(tx, 2099))),
    );
    expect([...numeri].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("contatore: 10 ordini creati in parallelo hanno progressivi diversi e consecutivi", async () => {
    const ordini = await Promise.all(
      Array.from({ length: 10 }, () =>
        creaOrdine({ clienteId, dataConsegna: null, urgente: false, note: null }, utenteId),
      ),
    );
    const prog = ordini.map((o) => o.progressivo).sort((a, b) => a - b);
    expect(prog).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it("flusso completo: pronto a metà, consegna parziale, poi tutto consegnato", async () => {
    const { ordine, riga } = await nuovoOrdineConRiga();
    expect((await leggiOrdine(ordine.id))!.stato).toBe("DA_FARE");

    await impostaQuantitaPronta(riga.id, 30);
    let o = (await leggiOrdine(ordine.id))!;
    expect(o.stato).toBe("IN_CORSO");
    expect(o.pezzi).toEqual({ totale: 50, pronti: 30, consegnati: 0 });

    await registraConsegna(ordine.id, { note: null, righe: [{ rigaId: riga.id, quantita: 30 }] }, utenteId);
    o = (await leggiOrdine(ordine.id))!;
    expect(o.stato).toBe("PARZIALMENTE_CONSEGNATO");

    await impostaQuantitaPronta(riga.id, 50);
    expect((await leggiOrdine(ordine.id))!.stato).toBe("PRONTO");

    await registraConsegna(ordine.id, { note: null, righe: [{ rigaId: riga.id, quantita: 20 }] }, utenteId);
    o = (await leggiOrdine(ordine.id))!;
    expect(o.stato).toBe("CONSEGNATO");
    expect(o.righe[0].statoMostrato).toBe("CONSEGNATA");
  });

  it("non si consegnano pezzi non pronti", async () => {
    const { ordine, riga } = await nuovoOrdineConRiga();
    await impostaQuantitaPronta(riga.id, 10);
    await expect(
      registraConsegna(ordine.id, { note: null, righe: [{ rigaId: riga.id, quantita: 11 }] }, utenteId),
    ).rejects.toThrow(/al massimo 10/);
  });

  it("non si consegna una riga di un altro ordine", async () => {
    const a = await nuovoOrdineConRiga();
    const b = await nuovoOrdineConRiga();
    await impostaQuantitaPronta(b.riga.id, 5);
    await expect(
      registraConsegna(a.ordine.id, { note: null, righe: [{ rigaId: b.riga.id, quantita: 5 }] }, utenteId),
    ).rejects.toThrow(/non appartiene/);
  });

  it("una consegna annullata non conta più", async () => {
    const { ordine, riga } = await nuovoOrdineConRiga();
    await impostaQuantitaPronta(riga.id, 50);
    const c = await registraConsegna(ordine.id, { note: null, righe: [{ rigaId: riga.id, quantita: 50 }] }, utenteId);
    expect((await leggiOrdine(ordine.id))!.stato).toBe("CONSEGNATO");
    await annullaConsegna(c.id);
    expect((await leggiOrdine(ordine.id))!.stato).toBe("PRONTO");
  });

  it("i pronti non scendono sotto i consegnati e non superano il totale", async () => {
    const { ordine, riga } = await nuovoOrdineConRiga();
    await impostaQuantitaPronta(riga.id, 20);
    await registraConsegna(ordine.id, { note: null, righe: [{ rigaId: riga.id, quantita: 20 }] }, utenteId);
    await expect(impostaQuantitaPronta(riga.id, 10)).rejects.toThrow(/consegnati/);
    await expect(impostaQuantitaPronta(riga.id, 51)).rejects.toThrow(/totale/);
  });

  it("modificare le varianti non può portare il totale sotto i pronti", async () => {
    const { riga } = await nuovoOrdineConRiga();
    await impostaQuantitaPronta(riga.id, 40);
    await expect(
      modificaRiga(riga.id, { ...rigaMagliette, varianti: [{ colore: "", taglia: "", quantita: 30 }] }),
    ).rejects.toThrow(/pronti/);
  });

  it("annullare l'ordine annulla tutte le righe e scrive lo storico", async () => {
    const { ordine, riga } = await nuovoOrdineConRiga();
    await aggiungiRiga(ordine.id, { ...rigaMagliette, descrizione: "Felpe" });
    await annullaOrdine(ordine.id, utenteId);
    const o = (await leggiOrdine(ordine.id))!;
    expect(o.stato).toBe("ANNULLATO");
    expect(await db.storicoStatoRiga.count({ where: { rigaId: riga.id, a: "ANNULLATA" } })).toBe(1);
  });

  it("la conferma bozza porta avanti lo stato ma non lo riporta indietro", async () => {
    const { riga } = await nuovoOrdineConRiga();
    await confermaBozza(riga.id, { modalita: "IN_SEDE", note: null }, utenteId);
    expect((await db.rigaOrdine.findUniqueOrThrow({ where: { id: riga.id } })).stato).toBe("BOZZA_CONFERMATA");

    await cambiaStatoRiga(riga.id, "IN_LAVORAZIONE", utenteId);
    await confermaBozza(riga.id, { modalita: "A_DISTANZA", note: null }, utenteId);
    expect((await db.rigaOrdine.findUniqueOrThrow({ where: { id: riga.id } })).stato).toBe("IN_LAVORAZIONE");
  });

  it("si elimina solo una riga senza storia", async () => {
    const { riga } = await nuovoOrdineConRiga();
    await cambiaStatoRiga(riga.id, "IN_LAVORAZIONE", utenteId);
    await expect(eliminaRiga(riga.id)).rejects.toThrow(/Annullata/);

    const { riga: nuova } = await nuovoOrdineConRiga();
    await eliminaRiga(nuova.id);
    expect(await db.rigaOrdine.findUnique({ where: { id: nuova.id } })).toBeNull();
  });

  it("il CHECK del database blocca le quantità negative anche senza Zod", async () => {
    const { riga } = await nuovoOrdineConRiga();
    await expect(db.rigaOrdine.update({ where: { id: riga.id }, data: { quantitaPronta: -1 } })).rejects.toThrow();
  });

  it("due varianti vuote uguali sulla stessa riga sono rifiutate dal database", async () => {
    const { riga } = await nuovoOrdineConRiga();
    await db.rigaVariante.create({ data: { rigaId: riga.id, quantita: 1 } });
    await expect(db.rigaVariante.create({ data: { rigaId: riga.id, quantita: 1 } })).rejects.toThrow();
  });

  it("pagamenti: acconto, saldo, niente doppio saldo, annullo, e il CHECK sull'acconto", async () => {
    const o = await creaOrdine({ clienteId, dataConsegna: null, urgente: false, note: null }, utenteId);
    await aggiungiRiga(o.id, { ...rigaMagliette, prezzoUnitario: "10" }); // 50 pezzi -> 500 (si incassa senza IVA)
    await registraPagamento(o.id, { tipo: "ACCONTO", importo: "100", note: null }, utenteId);
    let letto = await leggiOrdine(o.id);
    expect(letto?.pagamento.stato).toBe("ACCONTO");
    expect(letto?.pagamento.daPagare?.toString()).toBe("400");

    const s = await registraPagamento(o.id, { tipo: "SALDO", importo: "400", note: null }, utenteId);
    letto = await leggiOrdine(o.id);
    expect(letto?.pagamento.stato).toBe("PAGATO");
    await expect(registraPagamento(o.id, { tipo: "ACCONTO", importo: "5", note: null }, utenteId)).rejects.toThrow(
      /già pagato/,
    );

    await annullaPagamento(s.id);
    expect((await leggiOrdine(o.id))?.pagamento.stato).toBe("ACCONTO");

    // Anche senza Zod il database rifiuta un acconto senza importo.
    await expect(db.pagamento.create({ data: { ordineId: o.id, utenteId, tipo: "ACCONTO" } })).rejects.toThrow();
  });
});

// =============================================================================
// Magazzino (magazzino/database.ts)
// =============================================================================

describe.skipIf(!haDbTest)("magazzino sul database", () => {
  let utenteId: string;
  let clienteId: string;
  let articoloId: string;

  beforeEach(async () => {
    await svuotaDb();
    const { utente, cliente } = await creaUtenteECliente();
    utenteId = utente.id;
    clienteId = cliente.id;
    articoloId = (await db.articolo.create({ data: { nome: "T-shirt cotone" } })).id;
    await registraArrivo(articoloId, { colore: "Nero", taglia: "M", quantita: 20, note: null }, utenteId);
    await registraArrivo(articoloId, { colore: "Nero", taglia: "L", quantita: 3, note: null }, utenteId);
  });

  const giacenza = async (colore: string, taglia: string) =>
    (await leggiArticolo(articoloId))!.varianti.find((v) => v.colore === colore && v.taglia === taglia)?.giacenza;

  async function rigaConArticolo() {
    const o = await creaOrdine({ clienteId, dataConsegna: null, urgente: false, note: null }, utenteId);
    const r = await aggiungiRiga(o.id, {
      descrizione: "Magliette",
      tipo: "ABBIGLIAMENTO",
      articoloId,
      prezzoUnitario: null,
      note: null,
      // "nero"/"m" minuscoli: devono finire sulla variante "Nero"/"M"
      varianti: [
        { colore: "nero", taglia: "m", quantita: 10 },
        { colore: "Nero", taglia: "L", quantita: 5 },
      ],
      applicazioni: [],
    });
    return { ordineId: o.id, rigaId: r.id };
  }

  it("scala una volta sola in lavorazione, rimette se si torna indietro, e può andare sotto zero", async () => {
    const { rigaId } = await rigaConArticolo();
    expect(await giacenza("Nero", "M")).toBe(20); // da fare: niente scalato

    await cambiaStatoRiga(rigaId, "IN_LAVORAZIONE", utenteId);
    expect(await giacenza("Nero", "M")).toBe(10);
    expect(await giacenza("Nero", "L")).toBe(-2); // non blocca: va in rosso

    await cambiaStatoRiga(rigaId, "BOZZA_CONFERMATA", utenteId);
    await cambiaStatoRiga(rigaId, "IN_LAVORAZIONE", utenteId);
    await cambiaStatoRiga(rigaId, "IN_LAVORAZIONE", utenteId);
    expect(await giacenza("Nero", "M")).toBe(10); // avanti e indietro: sempre una volta sola

    await cambiaStatoRiga(rigaId, "DA_FARE", utenteId);
    expect(await giacenza("Nero", "M")).toBe(20);
    expect(await giacenza("Nero", "L")).toBe(3);
  });

  it("annullata: rimette i pezzi solo se richiesto", async () => {
    const a = await rigaConArticolo();
    await cambiaStatoRiga(a.rigaId, "IN_LAVORAZIONE", utenteId);
    await cambiaStatoRiga(a.rigaId, "ANNULLATA", utenteId, { rimetti: false });
    expect(await giacenza("Nero", "M")).toBe(10);
    // ripristinata e annullata di nuovo, stavolta rimettendo i pezzi
    await cambiaStatoRiga(a.rigaId, "IN_LAVORAZIONE", utenteId);
    expect(await giacenza("Nero", "M")).toBe(10);
    await annullaOrdine(a.ordineId, utenteId, { rimetti: true });
    expect(await giacenza("Nero", "M")).toBe(20);
  });

  it("modificare una riga in lavorazione scala solo la differenza; colori nuovi creano la variante", async () => {
    const { rigaId } = await rigaConArticolo();
    await cambiaStatoRiga(rigaId, "IN_LAVORAZIONE", utenteId);
    await modificaRiga(rigaId, {
      descrizione: "Magliette",
      tipo: "ABBIGLIAMENTO",
      articoloId,
      prezzoUnitario: null,
      note: null,
      varianti: [
        { colore: "Nero", taglia: "M", quantita: 12 },
        { colore: "Rosso", taglia: "S", quantita: 4 },
      ],
      applicazioni: [],
    });
    expect(await giacenza("Nero", "M")).toBe(8);
    expect(await giacenza("Nero", "L")).toBe(3); // la L non c'è più: rientrata
    expect(await giacenza("Rosso", "S")).toBe(-4);
  });

  it("correggi quantità: scrive la differenza per arrivare al numero contato", async () => {
    await correggiGiacenza(articoloId, { colore: "Nero", taglia: "M", quantita: 17, note: "conteggio" }, utenteId);
    expect(await giacenza("Nero", "M")).toBe(17);
    expect(
      await correggiGiacenza(articoloId, { colore: "Nero", taglia: "M", quantita: 17, note: null }, utenteId),
    ).toBeNull();
  });

  it("un prodotto scritto a mano non tocca il magazzino", async () => {
    const o = await creaOrdine({ clienteId, dataConsegna: null, urgente: false, note: null }, utenteId);
    const r = await aggiungiRiga(o.id, {
      descrizione: "Adesivi",
      tipo: "ADESIVI",
      articoloId: null,
      prezzoUnitario: null,
      note: null,
      varianti: [{ colore: "", taglia: "", quantita: 100 }],
      applicazioni: [],
    });
    await cambiaStatoRiga(r.id, "IN_LAVORAZIONE", utenteId);
    expect(await db.movimentoMagazzino.count({ where: { rigaId: r.id } })).toBe(0);
  });
});

// =============================================================================
// Utenti e codici invito (utenti/database.ts)
// =============================================================================

const persona = (n: string, codice = "") => ({
  nome: n,
  email: `${n.toLowerCase()}@negozio.it`,
  password: "Stampa2026!",
  conferma: "Stampa2026!",
  codice,
});

describe.skipIf(!haDbTest)("utenti e codici invito", () => {
  beforeEach(() => svuotaDb());

  it("il primo utente entra senza codice, il secondo no", async () => {
    const r = await registra(persona("Francesco"));
    expect(r.primo).toBe(true);
    await expect(registra(persona("Marco"))).rejects.toThrow(/Codice invito non valido/);
    await expect(registra(persona("Marco", "ABCD-EFGH"))).rejects.toThrow(/Codice invito non valido/);
  });

  it("un codice vale una volta sola", async () => {
    const { utente: io } = await registra(persona("Francesco"));
    const invito = await creaCodiceInvito(io.id);
    const scritto = invito.codice.toLowerCase().replace(/^(....)/, "$1 "); // scritto "male": va bene lo stesso
    const r = await registra(persona("Marco", scritto));
    expect(r.primo).toBe(false);
    const usato = await db.codiceInvito.findUniqueOrThrow({ where: { id: invito.id } });
    expect(usato.usatoDaId).toBe(r.utente.id);
    await expect(registra(persona("Luca", invito.codice))).rejects.toThrow(/Codice invito non valido/);
  });

  it("codici scaduti o annullati non valgono", async () => {
    const { utente: io } = await registra(persona("Francesco"));
    const scaduto = await creaCodiceInvito(io.id);
    await db.codiceInvito.update({ where: { id: scaduto.id }, data: { scadeIl: new Date(Date.now() - 1000) } });
    await expect(registra(persona("Marco", scaduto.codice))).rejects.toThrow(/scaduto/);
    const annullato = await creaCodiceInvito(io.id);
    await annullaCodiceInvito(annullato.id);
    await expect(registra(persona("Marco", annullato.codice))).rejects.toThrow(/non valido/);
  });

  it("email già registrata: errore, e il codice resta buono", async () => {
    const { utente: io } = await registra(persona("Francesco"));
    const invito = await creaCodiceInvito(io.id);
    await expect(registra(persona("Francesco", invito.codice))).rejects.toThrow(/Esiste già/);
    expect((await db.codiceInvito.findUniqueOrThrow({ where: { id: invito.id } })).usatoIl).toBeNull();
  });

  it("login: password giusta, sbagliata, utente disattivato", async () => {
    const { utente: io } = await registra(persona("Francesco"));
    const { utente: marco } = await registra(persona("Marco", (await creaCodiceInvito(io.id)).codice));
    expect(await verificaCredenziali("MARCO@negozio.it", "Stampa2026!")).not.toBeNull();
    expect(await verificaCredenziali("marco@negozio.it", "sbagliata")).toBeNull();
    expect(await verificaCredenziali("nessuno@negozio.it", "Stampa2026!")).toBeNull();
    await expect(impostaUtenteAttivo(io.id, false, io.id)).rejects.toThrow(/te stesso/);
    await impostaUtenteAttivo(marco.id, false, io.id);
    expect(await verificaCredenziali("marco@negozio.it", "Stampa2026!")).toBeNull();
  });

  it("password temporanea: la vecchia smette di funzionare e va cambiata", async () => {
    const { utente: io } = await registra(persona("Francesco"));
    const { utente: marco } = await registra(persona("Marco", (await creaCodiceInvito(io.id)).codice));
    await expect(impostaPasswordTemporanea(io.id, io.id)).rejects.toThrow(/Cambia password/);

    const temporanea = await impostaPasswordTemporanea(marco.id, io.id);
    expect(temporanea).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(await verificaCredenziali("marco@negozio.it", "Stampa2026!")).toBeNull();
    const dopo = await verificaCredenziali("marco@negozio.it", temporanea);
    expect(dopo?.devoCambiarePassword).toBe(true);
    expect(dopo?.sessioniValideDal).not.toBeNull();

    expect(await cambiaPassword(marco.id, "sbagliata", "NuovaPass99")).toBe(false);
    expect(await cambiaPassword(marco.id, temporanea, "NuovaPass99")).toBe("marco@negozio.it");
    const finale = await verificaCredenziali("marco@negozio.it", "NuovaPass99");
    expect(finale?.devoCambiarePassword).toBe(false);
  });
});
