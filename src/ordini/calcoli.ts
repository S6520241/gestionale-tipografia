// =============================================================================
// ordini/calcoli.ts — stati, pezzi, soldi e scadenze, calcolati dai dati
// =============================================================================
// Funzioni "pure": ricevono numeri e restituiscono numeri, senza database.
// Per questo si testano facilmente (tests/regole.test.ts).
//
// Regola di fondo: nel database si salva solo quello che decide una persona
// (bozza inviata, approvata, in lavorazione, annullata; i pezzi pronti; le
// consegne; i pagamenti). Tutto il resto si CALCOLA qui, ogni volta:
//   - "Pronta" e "Ritirata" di un prodotto, dalle quantità;
//   - lo stato dell'ordine, dai suoi prodotti;
//   - totale e stato del pagamento, dai prezzi e dai movimenti di cassa.
// Così un numero salvato non può mai "contraddire" gli altri.
//
// Si usa solo sul server: i soldi sono Prisma.Decimal (vedi sotto).

import { Prisma, type StatoRiga } from "@prisma/client";
import { giornoISO, giorniMancanti } from "@/comune/regole";

// -----------------------------------------------------------------------------
// Stato di un prodotto e dell'ordine
// -----------------------------------------------------------------------------

/** Stato di un prodotto come si mostra: quelli salvati più i due calcolati. */
export type StatoRigaMostrato = StatoRiga | "PRONTA" | "CONSEGNATA";

export type StatoOrdine =
  | "VUOTO" // nessun prodotto ancora inserito
  | "DA_FARE" // tutti i prodotti ancora da iniziare
  | "IN_CORSO" // almeno un prodotto avviato, niente ritirato
  | "PARZIALMENTE_CONSEGNATO" // il cliente ha già ritirato una parte
  | "PRONTO" // tutto quello non ancora ritirato è pronto
  | "CONSEGNATO" // tutto ritirato
  | "ANNULLATO"; // tutti i prodotti annullati

/** I numeri che servono per calcolare lo stato di un prodotto. */
export interface QuantitaRiga {
  stato: StatoRiga;
  quantitaTotale: number; // somma dei colori/taglie
  quantitaPronta: number;
  quantitaConsegnata: number; // somma delle consegne non annullate
}

export function statoRigaMostrato(r: QuantitaRiga): StatoRigaMostrato {
  if (r.stato === "ANNULLATA") return "ANNULLATA";
  // Con totale 0 (prodotto senza pezzi) non è né pronto né ritirato.
  if (r.quantitaTotale > 0 && r.quantitaConsegnata >= r.quantitaTotale) return "CONSEGNATA";
  if (r.quantitaTotale > 0 && r.quantitaPronta >= r.quantitaTotale) return "PRONTA";
  return r.stato;
}

export function statoOrdine(righe: QuantitaRiga[]): StatoOrdine {
  if (righe.length === 0) return "VUOTO";

  // I prodotti annullati non contano: se se ne annulla uno, l'ordine va avanti con gli altri.
  const attive = righe.filter((r) => r.stato !== "ANNULLATA");
  if (attive.length === 0) return "ANNULLATO";

  const mostrati = attive.map(statoRigaMostrato);
  if (mostrati.every((s) => s === "CONSEGNATA")) return "CONSEGNATO";
  if (mostrati.every((s) => s === "PRONTA" || s === "CONSEGNATA")) return "PRONTO";
  if (attive.some((r) => r.quantitaConsegnata > 0)) return "PARZIALMENTE_CONSEGNATO";
  if (attive.every((r) => r.stato === "DA_FARE" && r.quantitaPronta === 0)) return "DA_FARE";
  return "IN_CORSO";
}

/** Aperto = c'è ancora qualcosa da fare o da consegnare. */
export function isOrdineAperto(stato: StatoOrdine): boolean {
  return stato !== "CONSEGNATO" && stato !== "ANNULLATO";
}

/** Totali dei pezzi dell'ordine (per la barra verde/blu), senza i prodotti annullati. */
export function riepilogoPezzi(righe: QuantitaRiga[]) {
  const attive = righe.filter((r) => r.stato !== "ANNULLATA");
  return {
    totale: attive.reduce((s, r) => s + r.quantitaTotale, 0),
    // Math.min: un prodotto non può contare più pezzi pronti di quelli che ha.
    pronti: attive.reduce((s, r) => s + Math.min(r.quantitaPronta, r.quantitaTotale), 0),
    consegnati: attive.reduce((s, r) => s + Math.min(r.quantitaConsegnata, r.quantitaTotale), 0),
  };
}

/** Un prodotto letto dal database con varianti e consegne (vedi ordini/database.ts). */
export interface RigaConQuantita {
  stato: StatoRiga;
  quantitaPronta: number;
  varianti: { quantita: number }[];
  consegne: { quantita: number; consegna: { annullata: boolean } }[];
}

/** Dal prodotto letto dal database ai numeri di QuantitaRiga. */
export function quantitaRiga(r: RigaConQuantita): QuantitaRiga {
  return {
    stato: r.stato,
    quantitaPronta: r.quantitaPronta,
    quantitaTotale: r.varianti.reduce((s, v) => s + v.quantita, 0),
    quantitaConsegnata: r.consegne.filter((c) => !c.consegna.annullata).reduce((s, c) => s + c.quantita, 0),
  };
}

// -----------------------------------------------------------------------------
// Pagamenti
// -----------------------------------------------------------------------------
// I soldi sono Prisma.Decimal e non number: i number del computer sbagliano i
// centesimi (0.1 + 0.2 = 0.30000000000000004). Con Decimal si usano .add(),
// .mul(), .gt() (maggiore di) ecc. al posto di + * >.

export const ALIQUOTA_IVA = new Prisma.Decimal(22);

/**
 * I prezzi dei prodotti sono IVA esclusa. Per ora si incassa il prezzo SENZA IVA
 * (scelta di Francesco, 14/10/2026): i soldi ricevuti si confrontano con l'imponibile.
 * Per incassare IVA inclusa basta mettere true.
 */
export const INCASSO_CON_IVA = false;

export type StatoPagamento = "NON_PAGATO" | "ACCONTO" | "PAGATO";

type RigaConPrezzo = {
  stato: string;
  prezzoUnitario: Prisma.Decimal | null;
  quantitaTotale: number;
};
type Movimento = { tipo: "ACCONTO" | "SALDO"; importo: Prisma.Decimal | null; annullato: boolean };

/**
 * Totale dell'ordine (IVA esclusa, inclusa e quello da incassare), solo dai prodotti
 * non annullati con un prezzo. null se nessuno ha un prezzo: non sappiamo quanto deve pagare.
 */
export function totaleOrdine(righe: RigaConPrezzo[]) {
  const conPrezzo = righe.filter((r) => r.stato !== "ANNULLATA" && r.prezzoUnitario);
  if (conPrezzo.length === 0) return null;
  // Il "!" dice a TypeScript "qui non è null" (lo abbiamo appena filtrato).
  const imponibile = conPrezzo.reduce((s, r) => s.add(r.prezzoUnitario!.mul(r.quantitaTotale)), new Prisma.Decimal(0));
  // + 22%, arrotondato al centesimo come su uno scontrino.
  const ivato = imponibile.mul(ALIQUOTA_IVA.div(100).add(1)).toDecimalPlaces(2);
  return { imponibile, ivato, daIncassare: INCASSO_CON_IVA ? ivato : imponibile };
}

/**
 * Regole:
 *  - i pagamenti annullati non contano;
 *  - un SALDO ("ha pagato tutto") chiude il conto, anche se l'importo è diverso (sconto, arrotondamento);
 *  - senza saldo: se i soldi ricevuti coprono il totale è PAGATO, se c'è qualcosa è ACCONTO;
 *  - "daPagare" è null se l'ordine non ha prezzi (non sappiamo il totale).
 */
export function statoPagamento(totale: Prisma.Decimal | null, movimenti: Movimento[]) {
  const validi = movimenti.filter((m) => !m.annullato);
  const pagato = validi.reduce((s, m) => (m.importo ? s.add(m.importo) : s), new Prisma.Decimal(0));
  const saldato = validi.some((m) => m.tipo === "SALDO");

  let stato: StatoPagamento;
  if (saldato || (totale && totale.gt(0) && pagato.gte(totale))) stato = "PAGATO";
  else if (pagato.gt(0)) stato = "ACCONTO";
  else stato = "NON_PAGATO";

  const daPagare =
    stato === "PAGATO" ? new Prisma.Decimal(0) : totale ? Prisma.Decimal.max(totale.sub(pagato), 0) : null;
  return { stato, pagato, daPagare };
}

/** Il risultato di statoPagamento: { stato, pagato, daPagare }. */
export type RiepilogoPagamento = ReturnType<typeof statoPagamento>;

// -----------------------------------------------------------------------------
// Numero e scadenza
// -----------------------------------------------------------------------------

/** Numero leggibile: anno 2026, progressivo 7 -> "2026-0007". Solo per mostrarlo. */
export function formattaNumeroOrdine(o: { anno: number; progressivo: number }): string {
  return `${o.anno}-${String(o.progressivo).padStart(4, "0")}`;
}

/** Giorni da oggi alla data di consegna (negativo = in ritardo), null se non c'è una data. */
export function giorniAllaConsegna(data: Date | null): number | null {
  return data ? giorniMancanti(giornoISO(data)) : null;
}

/**
 * Quanto manca alla consegna, in parole semplici, e un "tono" che decide il colore:
 * ritardo = rosso, oggi/domani = ambra, entro una settimana = azzurro, poi grigio.
 * ("as const" fa sì che il tono sia proprio "ritardo" e non una stringa qualsiasi.)
 */
export function urgenzaScadenza(data: Date | null) {
  const g = giorniAllaConsegna(data);
  if (g === null) return { testo: "Senza data", tono: "nessuna" as const };
  if (g < 0)
    return { testo: g === -1 ? "In ritardo di 1 giorno" : `In ritardo di ${-g} giorni`, tono: "ritardo" as const };
  if (g === 0) return { testo: "Da consegnare oggi", tono: "oggi" as const };
  if (g === 1) return { testo: "Da consegnare domani", tono: "oggi" as const };
  if (g <= 7) return { testo: `Tra ${g} giorni`, tono: "presto" as const };
  return { testo: `Tra ${g} giorni`, tono: "tranquillo" as const };
}
