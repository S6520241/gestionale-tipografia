// =============================================================================
// magazzino/regole.ts — regole del magazzino, senza database
// =============================================================================
// Funzionano sul server e nel browser; testate in tests/regole.test.ts.
//
// Idea di fondo: la giacenza (quanti pezzi ci sono) NON è un numero salvato.
// Si salvano i movimenti (+20 arrivati, -10 messi in lavorazione...) e la
// giacenza è la loro somma. Così si sa sempre chi ha cambiato cosa e quando,
// e il numero non può "sbagliarsi" da solo.

import type { StatoRiga, TipoProdotto } from "@prisma/client";
import { z } from "zod";
import { testoOpzionale } from "@/comune/regole";

/** Chiave di una variante: "Nero"/"nero " e "M"/"m" sono la stessa cosa. */
export const chiaveVariante = (colore: string, taglia: string) =>
  `${colore.trim().toLowerCase()}|${taglia.trim().toLowerCase()}`;

/** Perché è cambiata la giacenza (campo "causale" di un movimento), come si legge nella pagina dell'articolo. */
export const CAUSALI = {
  CARICO_INIZIALE: "Inventario iniziale",
  ARRIVO: "Arrivata merce",
  CORREZIONE: "Correzione",
  LAVORAZIONE: "Messo in lavorazione",
  RIENTRO: "Tornato in magazzino",
} as const;

// -----------------------------------------------------------------------------
// Ordini e magazzino: quanti pezzi prende una riga d'ordine
// -----------------------------------------------------------------------------

type Voce = { colore: string; taglia: string; quantita: number };

/**
 * Quanti pezzi una riga d'ordine DEVE aver preso dal magazzino, per variante.
 *  - "In lavorazione": tutti i pezzi della riga;
 *  - prima (da fare, bozze): nessuno, i pezzi sono ancora in magazzino;
 *  - annullata: se si rimettono in magazzino nessuno, altrimenti restano presi
 *    quelli già presi (es. maglie già stampate e buttate).
 * Il risultato è una Map { chiave -> pezzi }; "giaPresi" serve solo per il caso annullata.
 */
export function pezziDaPrendere(
  stato: StatoRiga,
  voci: Voce[],
  giaPresi: Map<string, number>,
  rimetti = true,
): Map<string, number> {
  if (stato === "IN_LAVORAZIONE") {
    const m = new Map<string, number>();
    for (const v of voci) {
      const k = chiaveVariante(v.colore, v.taglia);
      m.set(k, (m.get(k) ?? 0) + v.quantita);
    }
    return m;
  }
  if (stato === "ANNULLATA" && !rimetti) return new Map(giaPresi);
  return new Map();
}

/**
 * Differenza tra quanto già preso e quanto va preso: un movimento per ogni chiave che cambia.
 * quantita < 0 = escono dal magazzino (LAVORAZIONE), > 0 = rientrano (RIENTRO).
 * Chiamarla due volte di fila non fa niente la seconda volta: per questo
 * cambiare stato avanti e indietro non scala mai due volte.
 */
export function movimentiPerAllineare(giaPresi: Map<string, number>, daPrendere: Map<string, number>) {
  const chiavi = new Set([...giaPresi.keys(), ...daPrendere.keys()]); // tutte le varianti coinvolte, senza doppioni
  const movimenti: { chiave: string; quantita: number }[] = [];
  for (const k of chiavi) {
    const delta = (giaPresi.get(k) ?? 0) - (daPrendere.get(k) ?? 0);
    if (delta !== 0) movimenti.push({ chiave: k, quantita: delta });
  }
  return movimenti;
}

// -----------------------------------------------------------------------------
// Ricerca
// -----------------------------------------------------------------------------

/** Testo minuscolo e senza accenti: "Perché" -> "perche". */
export function normalizzaTesto(testo: string) {
  return (
    testo
      .toLowerCase()
      // NFD separa le lettere dagli accenti ("é" -> "e" + accento)...
      .normalize("NFD")
      // ...e qui si tolgono gli accenti (sono i caratteri da U+0300 a U+036F).
      .replace(/[\u0300-\u036f]/g, "")
  );
}

/**
 * Parole da cercare, senza l'ultima vocale: così "felpa" trova "Felpe",
 * "nera" trova "Nero" e "polo" trova "Polo"/"Polos".
 */
export function paroleRicerca(testo: string): string[] {
  return normalizzaTesto(testo)
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (p.length > 3 ? p.replace(/[aeiou]$/, "") : p)); // le parole corte restano intere
}

// -----------------------------------------------------------------------------
// Tabella colori x taglie per mostrare la giacenza
// -----------------------------------------------------------------------------

const TAGLIE_LETTERE = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];

/** Ordina le taglie come in negozio: bambino/numeri prima (per numero), poi XS..5XL, poi il resto. */
export function ordinaTaglie(taglie: string[]): string[] {
  // "peso" di una taglia: più è piccolo, prima viene.
  const peso = (t: string) => {
    const i = TAGLIE_LETTERE.indexOf(t.trim().toUpperCase());
    if (i >= 0) return 1000 + i; // taglie a lettere: dopo i numeri
    const n = parseInt(t, 10);
    return Number.isNaN(n) ? 5000 : n; // numeri (es. "5/6" anni) per primi; tutto il resto in fondo
  };
  return [...taglie].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b, "it"));
}

/**
 * Da [{colore, taglia, giacenza}] a una tabella: righe = colori, colonne = taglie.
 * valore(colore, taglia) è undefined se quella combinazione non esiste.
 */
export function tabellaGiacenza(varianti: { colore: string; taglia: string; giacenza: number }[]) {
  const colori = [...new Set(varianti.map((v) => v.colore))].sort((a, b) => a.localeCompare(b, "it"));
  const taglie = ordinaTaglie([...new Set(varianti.map((v) => v.taglia))]);
  const mappa = new Map(varianti.map((v) => [chiaveVariante(v.colore, v.taglia), v.giacenza]));
  const valore = (colore: string, taglia: string) => mappa.get(chiaveVariante(colore, taglia));
  const totaleColore = (colore: string) =>
    varianti.filter((v) => v.colore === colore).reduce((t, v) => t + v.giacenza, 0);
  return { colori, taglie, valore, totaleColore };
}

// -----------------------------------------------------------------------------
// Tipo dell'articolo (abbigliamento, gadget...): non si chiede, si deduce
// -----------------------------------------------------------------------------

// Parole che fanno capire il tipo (espressioni regolari: "adesiv" trova adesivo, adesivi...).
const PAROLE_TIPO: [RegExp, TipoProdotto][] = [
  [/adesiv|etichett/, "ADESIVI"],
  [/pannell|forex|banner|striscion/, "PANNELLI"],
  [/gadget|zain|borse?\b|penn|tazz|borracc|portachiav|ombrell|accendin|chiavett/, "GADGET"],
];

/**
 * Il tipo serve al programma (es. le taglie solo per l'abbigliamento), ma non lo chiediamo:
 *  1) se nella stessa categoria ci sono già articoli, si usa il loro tipo;
 *  2) altrimenti si guardano le parole della categoria e del nome (es. "Gadget", "Zaini", "Adesivi");
 *  3) altrimenti abbigliamento, che è la maggior parte del magazzino.
 */
export function tipoArticolo(
  categoria: string | null,
  nome: string,
  tipoCategoria?: TipoProdotto | null,
): TipoProdotto {
  if (tipoCategoria) return tipoCategoria;
  const testo = `${categoria ?? ""} ${nome}`.toLowerCase();
  return PAROLE_TIPO.find(([re]) => re.test(testo))?.[1] ?? "ABBIGLIAMENTO";
}

// -----------------------------------------------------------------------------
// Moduli (schemi Zod)
// -----------------------------------------------------------------------------

/** Modulo "Nuovo articolo" / "Modifica nome o categoria". */
export const articoloSchema = z.object({
  nome: z.string().trim().min(1, "Scrivi il nome dell'articolo").max(120),
  categoria: testoOpzionale,
  note: testoOpzionale,
});
export type ArticoloInput = z.infer<typeof articoloSchema>;

/** "Arrivata merce" o "Correggi quantità": su quale colore/taglia e quanti pezzi. */
export const movimentoSchema = z.object({
  colore: z.string().trim().max(50).default(""),
  taglia: z.string().trim().max(20).default(""),
  // z.coerce.number: il modulo manda "12" (testo), qui diventa 12 (numero).
  quantita: z.coerce.number({ error: "Scrivi un numero" }).int("Numero intero").min(0, "Non può essere negativo"),
  note: testoOpzionale,
});
export type MovimentoInput = z.infer<typeof movimentoSchema>;
