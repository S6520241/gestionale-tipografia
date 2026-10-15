// =============================================================================
// tests/regole.test.ts — test delle regole "pure" (senza database)
// =============================================================================
// Si lanciano con:  npm test
// Ogni describe() è un gruppo di prove, ogni it() una prova. expect(x).toBe(y)
// controlla che x sia uguale a y: se non lo è, il test fallisce e dice dove.
// I test che usano il database sono in tests/database.test.ts.

import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { clienteSchema } from "@/clienti/regole";
import { NOME_AZIENDA, sigla } from "@/comune/azienda";
import { giorniMancanti, oggiISO } from "@/comune/regole";
import {
  chiaveVariante,
  movimentiPerAllineare,
  ordinaTaglie,
  paroleRicerca,
  pezziDaPrendere,
  tabellaGiacenza,
  tipoArticolo,
} from "@/magazzino/regole";
import {
  formattaNumeroOrdine,
  isOrdineAperto,
  type QuantitaRiga,
  quantitaRiga,
  riepilogoPezzi,
  statoOrdine,
  statoPagamento,
  statoRigaMostrato,
  totaleOrdine,
} from "@/ordini/calcoli";
import { consegnaSchema, pagamentoSchema, rigaSchema } from "@/ordini/regole";
import {
  cambioPasswordSchema,
  formattaCodice,
  generaCodice,
  normalizzaCodice,
  registrazioneSchema,
  statoAccesso,
} from "@/utenti/regole";

// =============================================================================
// Date (comune/regole.ts) e numero dell'ordine (ordini/calcoli.ts)
// =============================================================================

describe("numero ordine e date", () => {
  it("formatta anno-progressivo a 4 cifre", () => {
    expect(formattaNumeroOrdine({ anno: 2026, progressivo: 7 })).toBe("2026-0007");
    expect(formattaNumeroOrdine({ anno: 2026, progressivo: 12345 })).toBe("2026-12345");
  });

  it("usa il giorno italiano, non quello UTC", () => {
    // 31/12 alle 23:30 UTC in Italia è già il 1 gennaio.
    expect(oggiISO(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("conta i giorni mancanti", () => {
    expect(giorniMancanti("2026-10-20", "2026-10-14")).toBe(6);
    expect(giorniMancanti("2026-10-13", "2026-10-14")).toBe(-1);
  });
});

// =============================================================================
// Utenti e accesso (utenti/regole.ts)
// =============================================================================

describe("stato di accesso", () => {
  const base = { attivo: true, devoCambiarePassword: false, sessioniValideDal: null };
  const ieri = new Date(Date.now() - 86_400_000);

  it("utente attivo entra", () => expect(statoAccesso(base, Date.now())).toBe("ENTRA"));
  it("utente disattivato o inesistente resta fuori", () => {
    expect(statoAccesso({ ...base, attivo: false }, Date.now())).toBe("FUORI");
    expect(statoAccesso(null, Date.now())).toBe("FUORI");
  });
  it("un accesso fatto prima del cambio password non vale più", () => {
    const u = { ...base, sessioniValideDal: ieri };
    expect(statoAccesso(u, ieri.getTime() - 1000)).toBe("FUORI");
    expect(statoAccesso(u, undefined)).toBe("FUORI");
    expect(statoAccesso(u, Date.now())).toBe("ENTRA");
  });
  it("con password temporanea deve cambiarla", () =>
    expect(statoAccesso({ ...base, devoCambiarePassword: true }, Date.now())).toBe("CAMBIA_PASSWORD"));
});

describe("codici invito", () => {
  it("si scrivono come si vuole", () => {
    expect(normalizzaCodice(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizzaCodice("ab cd ef gh")).toBe("ABCDEFGH");
    expect(formattaCodice("ABCDEFGH")).toBe("ABCD-EFGH");
  });
  it("usano solo caratteri che non si confondono", () => {
    let i = 0;
    const codice = generaCodice(() => i++ % 31);
    expect(codice).toHaveLength(8);
    expect(generaCodice((n) => n - 1, 200)).not.toMatch(/[01OIL]/);
  });
});

describe("regole password", () => {
  const dati = { nome: "Marco", email: "Marco@Negozio.it", password: "Stampa2026!", conferma: "Stampa2026!" };

  it("accetta una registrazione corretta (email in minuscolo)", () => {
    const r = registrazioneSchema.parse(dati);
    expect(r.email).toBe("marco@negozio.it");
    expect(r.codice).toBe("");
  });
  it("rifiuta password corte, ovvie, diverse o con l'email", () => {
    const errore = (d: object) => registrazioneSchema.safeParse({ ...dati, ...d }).error?.issues[0]?.message;
    expect(errore({ password: "corta1", conferma: "corta1" })).toMatch(/8 caratteri/);
    expect(errore({ password: "12345678", conferma: "12345678" })).toMatch(/facile/);
    expect(errore({ password: "aaaaaaaaa", conferma: "aaaaaaaaa" })).toMatch(/facile/);
    expect(errore({ conferma: "altra-cosa" })).toMatch(/uguali/);
    expect(errore({ password: "marco12345", conferma: "marco12345" })).toMatch(/email/);
  });
  it("rifiuta il nome dell'azienda come password", () => {
    const nome = NOME_AZIENDA.toLowerCase().replace(/\s+/g, "");
    const r = registrazioneSchema.safeParse({ ...dati, password: `${nome}123`, conferma: `${nome}123` });
    expect(r.error?.issues[0]?.message).toMatch(/facile/);
  });
  it("la nuova password deve essere diversa da quella attuale", () => {
    const r = cambioPasswordSchema.safeParse({ attuale: "Stampa2026!", nuova: "Stampa2026!", conferma: "Stampa2026!" });
    expect(r.error?.issues[0]?.message).toMatch(/diversa/);
  });
});

describe("sigla dell'azienda", () => {
  it("iniziali di due parole, maiuscole di una parola, oppure le prime due lettere", () => {
    expect(sigla("Tipografia Rossi")).toBe("TR");
    expect(sigla("PrintLab")).toBe("PL");
    expect(sigla("stamperia")).toBe("ST");
    expect(sigla("  Ricami   del  Porto ")).toBe("RD");
  });
});

// =============================================================================
// Clienti (clienti/regole.ts)
// =============================================================================

describe("clienteSchema", () => {
  it("trasforma i campi vuoti in null", () => {
    const c = clienteSchema.parse({ nome: " Bar Mario ", telefono: "", email: "  " });
    expect(c).toMatchObject({ nome: "Bar Mario", telefono: null, email: null, partitaIva: null });
  });

  it("controlla email e partita IVA solo se presenti", () => {
    expect(clienteSchema.safeParse({ nome: "X", email: "non-una-email" }).success).toBe(false);
    expect(clienteSchema.safeParse({ nome: "X", partitaIva: "123" }).success).toBe(false);
    expect(clienteSchema.safeParse({ nome: "X", partitaIva: "01234567890" }).success).toBe(true);
  });
});

// =============================================================================
// Magazzino (magazzino/regole.ts)
// =============================================================================

// Un prodotto d'esempio: 10 magliette nere M e 5 nere L.
const voci = [
  { colore: "Nero", taglia: "M", quantita: 10 },
  { colore: "Nero", taglia: "L", quantita: 5 },
];
const k = chiaveVariante; // nome corto, per scrivere meno

describe("pezziDaPrendere", () => {
  it("in lavorazione: tutti i pezzi della riga, per colore e taglia", () => {
    const m = pezziDaPrendere("IN_LAVORAZIONE", voci, new Map());
    expect(m.get(k("nero ", "m"))).toBe(10);
    expect(m.get(k("Nero", "L"))).toBe(5);
  });

  it("prima della lavorazione: niente", () => {
    expect(pezziDaPrendere("BOZZA_CONFERMATA", voci, new Map()).size).toBe(0);
  });

  it("annullata: rimetti = niente, non rimettere = restano quelli già presi", () => {
    const presi = new Map([[k("Nero", "M"), 10]]);
    expect(pezziDaPrendere("ANNULLATA", voci, presi, true).size).toBe(0);
    expect(pezziDaPrendere("ANNULLATA", voci, presi, false)).toEqual(presi);
  });
});

describe("movimentiPerAllineare", () => {
  it("la prima volta scala, la seconda non fa niente (niente doppio scarico)", () => {
    const daPrendere = pezziDaPrendere("IN_LAVORAZIONE", voci, new Map());
    const prima = movimentiPerAllineare(new Map(), daPrendere);
    expect(prima).toEqual([
      { chiave: k("Nero", "M"), quantita: -10 },
      { chiave: k("Nero", "L"), quantita: -5 },
    ]);
    expect(movimentiPerAllineare(daPrendere, daPrendere)).toEqual([]);
  });

  it("tornando indietro rientra tutto; cambiando quantità si muove solo la differenza", () => {
    const presi = new Map([
      [k("Nero", "M"), 10],
      [k("Nero", "L"), 5],
    ]);
    expect(movimentiPerAllineare(presi, new Map())).toEqual([
      { chiave: k("Nero", "M"), quantita: 10 },
      { chiave: k("Nero", "L"), quantita: 5 },
    ]);
    const nuovi = new Map([
      [k("Nero", "M"), 12],
      [k("Nero", "L"), 5],
    ]);
    expect(movimentiPerAllineare(presi, nuovi)).toEqual([{ chiave: k("Nero", "M"), quantita: -2 }]);
  });
});

describe("tabella giacenza", () => {
  it("ordina le taglie: numeri/bambino, poi lettere, poi il resto", () => {
    expect(ordinaTaglie(["XL", "M", "Lungo", "3XL", "5/6", "S", "1 ANNO", "XXS"])).toEqual([
      "1 ANNO",
      "5/6",
      "XXS",
      "S",
      "M",
      "XL",
      "3XL",
      "Lungo",
    ]);
  });

  it("costruisce la tabella colori x taglie", () => {
    const t = tabellaGiacenza([
      { colore: "Nero", taglia: "M", giacenza: 3 },
      { colore: "Nero", taglia: "S", giacenza: -1 },
      { colore: "Bianco", taglia: "M", giacenza: 0 },
    ]);
    expect(t.colori).toEqual(["Bianco", "Nero"]);
    expect(t.taglie).toEqual(["S", "M"]);
    expect(t.valore("Nero", "S")).toBe(-1);
    expect(t.valore("Bianco", "S")).toBeUndefined();
    expect(t.totaleColore("Nero")).toBe(2);
  });
});

it("la ricerca ignora singolare/plurale e accenti", () => {
  expect(paroleRicerca("Felpa  nera")).toEqual(["felp", "ner"]);
  expect(paroleRicerca("perché XL")).toEqual(["perch", "xl"]);
});

describe("tipo dell'articolo dedotto", () => {
  it("usa il tipo degli altri articoli della categoria", () => {
    expect(tipoArticolo("Zaini", "Zaino nuovo", "GADGET")).toBe("GADGET");
  });
  it("categoria nuova: guarda le parole, altrimenti abbigliamento", () => {
    expect(tipoArticolo("Tazze", "Tazza bianca")).toBe("GADGET");
    expect(tipoArticolo("Adesivi", "Vinile")).toBe("ADESIVI");
    expect(tipoArticolo("Cappellini", "Cappello baseball")).toBe("ABBIGLIAMENTO");
    expect(tipoArticolo(null, "Penne a scatto")).toBe("GADGET");
  });
});

// =============================================================================
// Stato di prodotti e ordini (ordini/calcoli.ts)
// =============================================================================

// Piccola "fabbrica" per scrivere i casi in una riga sola.
function riga(p: Partial<QuantitaRiga> = {}): QuantitaRiga {
  return { stato: "DA_FARE", quantitaTotale: 50, quantitaPronta: 0, quantitaConsegnata: 0, ...p };
}

describe("statoRigaMostrato", () => {
  it("mostra lo stato salvato se non è né pronta né consegnata", () => {
    expect(statoRigaMostrato(riga({ stato: "IN_LAVORAZIONE", quantitaPronta: 30 }))).toBe("IN_LAVORAZIONE");
  });

  it("è PRONTA quando tutti i pezzi sono pronti, qualunque sia lo stato salvato", () => {
    expect(statoRigaMostrato(riga({ stato: "IN_LAVORAZIONE", quantitaPronta: 50 }))).toBe("PRONTA");
    expect(statoRigaMostrato(riga({ stato: "DA_FARE", quantitaPronta: 50 }))).toBe("PRONTA");
  });

  it("è CONSEGNATA quando tutto è consegnato (vince su PRONTA)", () => {
    expect(statoRigaMostrato(riga({ quantitaPronta: 50, quantitaConsegnata: 50 }))).toBe("CONSEGNATA");
  });

  it("ANNULLATA vince su tutto", () => {
    expect(statoRigaMostrato(riga({ stato: "ANNULLATA", quantitaPronta: 50, quantitaConsegnata: 50 }))).toBe(
      "ANNULLATA",
    );
  });

  it("una riga senza pezzi non è mai pronta", () => {
    expect(statoRigaMostrato(riga({ quantitaTotale: 0 }))).toBe("DA_FARE");
  });
});

describe("statoOrdine", () => {
  it("VUOTO senza righe", () => {
    expect(statoOrdine([])).toBe("VUOTO");
  });

  it("DA_FARE se nessuna riga è iniziata", () => {
    expect(statoOrdine([riga(), riga()])).toBe("DA_FARE");
  });

  it("IN_CORSO se almeno una riga è avviata", () => {
    expect(statoOrdine([riga(), riga({ stato: "BOZZA_INVIATA" })])).toBe("IN_CORSO");
  });

  it("IN_CORSO se una riga è pronta a metà (30 su 50)", () => {
    expect(statoOrdine([riga({ quantitaPronta: 30 })])).toBe("IN_CORSO");
  });

  it("IN_CORSO se una riga è pronta e l'altra no", () => {
    expect(statoOrdine([riga({ quantitaPronta: 50 }), riga({ stato: "IN_LAVORAZIONE" })])).toBe("IN_CORSO");
  });

  it("PRONTO se tutte le righe attive sono pronte", () => {
    expect(statoOrdine([riga({ quantitaPronta: 50 }), riga({ quantitaPronta: 50 })])).toBe("PRONTO");
  });

  it("PRONTO se una parte è consegnata e il resto è pronto da ritirare", () => {
    expect(statoOrdine([riga({ quantitaPronta: 50, quantitaConsegnata: 50 }), riga({ quantitaPronta: 50 })])).toBe(
      "PRONTO",
    );
  });

  it("PARZIALMENTE_CONSEGNATO se il cliente ha ritirato una parte e il resto non è pronto", () => {
    expect(statoOrdine([riga({ quantitaPronta: 30, quantitaConsegnata: 30 }), riga({ stato: "IN_LAVORAZIONE" })])).toBe(
      "PARZIALMENTE_CONSEGNATO",
    );
  });

  it("CONSEGNATO se tutto è consegnato", () => {
    expect(statoOrdine([riga({ quantitaPronta: 50, quantitaConsegnata: 50 })])).toBe("CONSEGNATO");
  });

  it("le righe annullate non contano", () => {
    expect(statoOrdine([riga({ quantitaPronta: 50, quantitaConsegnata: 50 }), riga({ stato: "ANNULLATA" })])).toBe(
      "CONSEGNATO",
    );
  });

  it("ANNULLATO se tutte le righe sono annullate", () => {
    expect(statoOrdine([riga({ stato: "ANNULLATA" }), riga({ stato: "ANNULLATA" })])).toBe("ANNULLATO");
  });

  it("aperto = non consegnato e non annullato", () => {
    expect(isOrdineAperto("PRONTO")).toBe(true);
    expect(isOrdineAperto("VUOTO")).toBe(true);
    expect(isOrdineAperto("CONSEGNATO")).toBe(false);
    expect(isOrdineAperto("ANNULLATO")).toBe(false);
  });
});

describe("quantitaRiga e riepilogoPezzi", () => {
  it("somma varianti e consegne, ignorando le consegne annullate", () => {
    const q = quantitaRiga({
      stato: "IN_LAVORAZIONE",
      quantitaPronta: 25,
      varianti: [{ quantita: 20 }, { quantita: 10 }],
      consegne: [
        { quantita: 10, consegna: { annullata: false } },
        { quantita: 5, consegna: { annullata: true } },
      ],
    });
    expect(q).toEqual({ stato: "IN_LAVORAZIONE", quantitaTotale: 30, quantitaPronta: 25, quantitaConsegnata: 10 });
  });

  it("il riepilogo esclude le righe annullate", () => {
    const r = riepilogoPezzi([riga({ quantitaPronta: 20, quantitaConsegnata: 10 }), riga({ stato: "ANNULLATA" })]);
    expect(r).toEqual({ totale: 50, pronti: 20, consegnati: 10 });
  });
});

// =============================================================================
// Pagamenti (ordini/calcoli.ts e pagamentoSchema)
// =============================================================================

// Scorciatoie: D(10) = 10 euro come Decimal; acconto(30) e saldo(65) = movimenti di cassa.
const D = (n: number | string) => new Prisma.Decimal(n);
const acconto = (n: number, annullato = false) => ({ tipo: "ACCONTO" as const, importo: D(n), annullato });
const saldo = (n: number | null = null) => ({
  tipo: "SALDO" as const,
  importo: n === null ? null : D(n),
  annullato: false,
});

describe("totaleOrdine", () => {
  it("somma solo le righe non annullate con prezzo e calcola anche l'IVA al 22%", () => {
    const t = totaleOrdine([
      { stato: "DA_FARE", prezzoUnitario: D("12.50"), quantitaTotale: 25 }, // 312,50
      { stato: "ANNULLATA", prezzoUnitario: D(100), quantitaTotale: 1 },
      { stato: "DA_FARE", prezzoUnitario: null, quantitaTotale: 10 },
    ]);
    expect(t?.imponibile.toString()).toBe("312.5");
    expect(t?.ivato.toString()).toBe("381.25");
    expect(t?.daIncassare.toString()).toBe("312.5"); // per ora si incassa senza IVA
  });

  it("è null se nessuna riga ha un prezzo", () => {
    expect(totaleOrdine([{ stato: "DA_FARE", prezzoUnitario: null, quantitaTotale: 5 }])).toBeNull();
  });
});

describe("statoPagamento", () => {
  const totale = D(100);

  it("senza pagamenti: non pagato, deve tutto", () => {
    const p = statoPagamento(totale, []);
    expect(p.stato).toBe("NON_PAGATO");
    expect(p.daPagare?.toString()).toBe("100");
  });

  it("con un acconto: acconto, mostra quanto manca", () => {
    const p = statoPagamento(totale, [acconto(30), acconto(20)]);
    expect(p.stato).toBe("ACCONTO");
    expect(p.pagato.toString()).toBe("50");
    expect(p.daPagare?.toString()).toBe("50");
  });

  it("gli acconti che coprono il totale valgono come pagato", () => {
    expect(statoPagamento(totale, [acconto(60), acconto(40)]).stato).toBe("PAGATO");
  });

  it("un acconto annullato non conta", () => {
    expect(statoPagamento(totale, [acconto(30, true)]).stato).toBe("NON_PAGATO");
  });

  it("il saldo chiude il conto anche con uno sconto", () => {
    const p = statoPagamento(totale, [acconto(30), saldo(65)]);
    expect(p.stato).toBe("PAGATO");
    expect(p.daPagare?.toString()).toBe("0");
  });

  it("senza prezzi: si segna pagato a mano, e non si sa quanto manca", () => {
    expect(statoPagamento(null, [acconto(50)])).toMatchObject({ stato: "ACCONTO", daPagare: null });
    expect(statoPagamento(null, [saldo()]).stato).toBe("PAGATO");
  });
});

describe("pagamentoSchema", () => {
  it("l'acconto vuole l'importo, il saldo no", () => {
    expect(pagamentoSchema.safeParse({ tipo: "ACCONTO", importo: "" }).success).toBe(false);
    expect(pagamentoSchema.parse({ tipo: "ACCONTO", importo: "50,5" }).importo).toBe("50.5");
    expect(pagamentoSchema.parse({ tipo: "SALDO", importo: "" }).importo).toBeNull();
    expect(pagamentoSchema.safeParse({ tipo: "ACCONTO", importo: "0" }).success).toBe(false);
  });
});

// =============================================================================
// Modulo del prodotto e consegne (ordini/regole.ts)
// =============================================================================

// Il prodotto più semplice possibile: le prove ne cambiano un pezzo alla volta.
const rigaBase = {
  descrizione: "Magliette",
  tipo: "ABBIGLIAMENTO",
  varianti: [{ colore: "Nero", taglia: "M", quantita: 20 }],
};

describe("rigaSchema", () => {
  it("accetta una riga minima e mette i default", () => {
    const r = rigaSchema.parse(rigaBase);
    expect(r.applicazioni).toEqual([]);
    expect(r.prezzoUnitario).toBeNull();
  });

  it("converte il prezzo con la virgola", () => {
    expect(rigaSchema.parse({ ...rigaBase, prezzoUnitario: "12,5" }).prezzoUnitario).toBe("12.5");
    expect(rigaSchema.safeParse({ ...rigaBase, prezzoUnitario: "12,555" }).success).toBe(false);
  });

  it("stampa e ricamo solo per abbigliamento e altro", () => {
    const ricamo = { tecnica: "RICAMO", parametri: { coloriFili: ["Oro"] } };
    expect(rigaSchema.safeParse({ ...rigaBase, applicazioni: [ricamo] }).success).toBe(true);
    expect(
      rigaSchema.safeParse({ ...rigaBase, tipo: "ALTRO", varianti: [{ quantita: 5 }], applicazioni: [ricamo] }).success,
    ).toBe(true);
    for (const tipo of ["GADGET", "ADESIVI", "PANNELLI"]) {
      const senzaTaglia = { ...rigaBase, tipo, varianti: [{ quantita: 50 }] };
      const r = rigaSchema.safeParse({ ...senzaTaglia, applicazioni: [ricamo] });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(["applicazioni"]);
      // Senza lavorazioni un gadget va benissimo.
      expect(rigaSchema.safeParse(senzaTaglia).success).toBe(true);
    }
  });

  it("taglia solo per abbigliamento, il colore sempre", () => {
    const altro = { ...rigaBase, tipo: "ALTRO" };
    expect(rigaSchema.safeParse(altro).success).toBe(false); // rigaBase ha taglia "M"
    const gadget = { ...rigaBase, tipo: "GADGET" };
    expect(rigaSchema.safeParse({ ...gadget, varianti: [{ colore: "Rosso", quantita: 50 }] }).success).toBe(true);
    const r = rigaSchema.safeParse({ ...gadget, varianti: [{ colore: "Rosso", taglia: "M", quantita: 50 }] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["varianti", 0, "taglia"]);
  });

  it("accetta più stampe in posizioni diverse sullo stesso capo", () => {
    const stampa = (posizione: string) => ({ tecnica: "STAMPA", posizione, parametri: { colori: ["Nero"] } });
    const r = rigaSchema.parse({ ...rigaBase, applicazioni: [stampa("CUORE"), stampa("SPALLE"), stampa("ALTRO")] });
    expect(r.applicazioni.map((a) => a.posizione)).toEqual(["CUORE", "SPALLE", "ALTRO"]);
  });

  it("rifiuta varianti ripetute anche con maiuscole diverse", () => {
    const r = rigaSchema.safeParse({
      ...rigaBase,
      varianti: [
        { colore: "Nero", taglia: "M", quantita: 1 },
        { colore: "nero", taglia: "m", quantita: 2 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rifiuta quantità zero o nessuna variante", () => {
    expect(rigaSchema.safeParse({ ...rigaBase, varianti: [{ quantita: 0 }] }).success).toBe(false);
    expect(rigaSchema.safeParse({ ...rigaBase, varianti: [] }).success).toBe(false);
  });

  it("valida i parametri in base alla tecnica (discriminated union)", () => {
    const ok = rigaSchema.parse({
      ...rigaBase,
      applicazioni: [
        { tecnica: "STAMPA", posizione: "CUORE", parametri: { colori: ["Bianco"] } },
        { tecnica: "RICAMO", posizione: "SPALLE", parametri: { coloriFili: ["Oro"], numeroPunti: 8000 } },
        { tecnica: "ALTRO", posizione: null },
      ],
    });
    expect(ok.applicazioni).toHaveLength(3);

    // Un ricamo con i parametri della stampa non passa.
    const ko = rigaSchema.safeParse({
      ...rigaBase,
      applicazioni: [{ tecnica: "RICAMO", posizione: null, parametri: { coloriFili: "Oro" } }],
    });
    expect(ko.success).toBe(false);
  });
});

describe("consegnaSchema", () => {
  it("ignora le righe a zero e pretende almeno una quantità", () => {
    const c = consegnaSchema.parse({
      righe: [
        { rigaId: "a", quantita: "0" },
        { rigaId: "b", quantita: "3" },
      ],
    });
    expect(c.righe).toEqual([{ rigaId: "b", quantita: 3 }]);
    expect(consegnaSchema.safeParse({ righe: [{ rigaId: "a", quantita: 0 }] }).success).toBe(false);
  });
});
