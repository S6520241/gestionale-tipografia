// =============================================================================
// ordini/regole.ts — testi degli stati e controlli dei moduli degli ordini
// =============================================================================
// Niente database e niente calcoli con i soldi: questo file si usa anche nel
// browser (il modulo del prodotto, RigaForm, ne prende etichette e regole).
// I calcoli su stati e pagamenti sono in ordini/calcoli.ts.

import type { ModalitaConferma, PosizioneApplicazione, StatoRiga, Tecnica, TipoProdotto } from "@prisma/client";
import { z } from "zod";
import type { ColoreBadge } from "@/comune/componenti";
import { checkbox, giornoOpzionale, prezzoOpzionale, testoOpzionale } from "@/comune/regole";
import { chiaveVariante } from "@/magazzino/regole";
import type { StatoOrdine, StatoRigaMostrato } from "./calcoli";

// -----------------------------------------------------------------------------
// Etichette: i testi in italiano dei valori salvati nel database
// -----------------------------------------------------------------------------
// Nel database si salvano parole in maiuscolo (es. "BOZZA_INVIATA"); qui c'è
// come si leggono sullo schermo. Per cambiare un testo basta cambiarlo qui.
// Record<TipoProdotto, string> obbliga ad avere un testo per OGNI valore:
// se un giorno se ne aggiunge uno allo schema, TypeScript avvisa.

export const TIPI_PRODOTTO: Record<TipoProdotto, string> = {
  ABBIGLIAMENTO: "Abbigliamento",
  ADESIVI: "Adesivi",
  PANNELLI: "Pannelli",
  GADGET: "Gadget",
  ALTRO: "Altro",
};

export const TECNICHE: Record<Tecnica, string> = {
  STAMPA: "Stampa",
  RICAMO: "Ricamo",
  ALTRO: "Altro",
};

export const POSIZIONI: Record<PosizioneApplicazione, string> = {
  CUORE: "Cuore",
  SPALLE: "Spalle",
  MANICA: "Manica",
  ALTRO: "Altro",
};

/** Come è stata approvata la bozza. */
export const MODALITA_CONFERMA: Record<ModalitaConferma, string> = {
  IN_SEDE: "Vista in negozio",
  A_DISTANZA: "Approvata a distanza",
};

/** Gli stati salvati di un prodotto, cioè quelli che sceglie una persona (Pronta e Ritirata si calcolano). */
export const STATI_RIGA: Record<StatoRiga, string> = {
  DA_FARE: "Da fare",
  BOZZA_INVIATA: "Bozza inviata",
  BOZZA_CONFERMATA: "Bozza approvata",
  IN_LAVORAZIONE: "In lavorazione",
  ANNULLATA: "Annullata",
};

/** Lo stato di un prodotto come si mostra (anche Pronta e Ritirata), con il colore del badge. */
export const STATO_RIGA_MOSTRATO: Record<StatoRigaMostrato, { testo: string; colore: ColoreBadge }> = {
  DA_FARE: { testo: "Da fare", colore: "grigio" },
  BOZZA_INVIATA: { testo: "Bozza inviata", colore: "viola" },
  BOZZA_CONFERMATA: { testo: "Bozza approvata", colore: "azzurro" },
  IN_LAVORAZIONE: { testo: "In lavorazione", colore: "ambra" },
  PRONTA: { testo: "Pronta", colore: "verde" },
  CONSEGNATA: { testo: "Ritirata", colore: "blu" },
  ANNULLATA: { testo: "Annullata", colore: "rosso" },
};

/** Lo stato dell'ordine (calcolato dai suoi prodotti), con il colore del badge. */
export const STATO_ORDINE: Record<StatoOrdine, { testo: string; colore: ColoreBadge }> = {
  VUOTO: { testo: "Senza prodotti", colore: "grigio" },
  DA_FARE: { testo: "Da fare", colore: "grigio" },
  IN_CORSO: { testo: "In corso", colore: "ambra" },
  PARZIALMENTE_CONSEGNATO: { testo: "Ritirato in parte", colore: "azzurro" },
  PRONTO: { testo: "Pronto da ritirare", colore: "verde" },
  CONSEGNATO: { testo: "Ritirato", colore: "blu" },
  ANNULLATO: { testo: "Annullato", colore: "rosso" },
};

// -----------------------------------------------------------------------------
// Moduli dell'ordine (schemi Zod)
// -----------------------------------------------------------------------------

/** Modulo "Nuovo ordine" / "Modifica ordine". */
export const ordineSchema = z.object({
  clienteId: z.string().min(1, "Scegli un cliente"),
  dataConsegna: giornoOpzionale,
  urgente: checkbox,
  note: testoOpzionale,
});
export type OrdineInput = z.infer<typeof ordineSchema>;

/** Il contatore "Quanti pezzi sono pronti?". */
export const quantitaProntaSchema = z.object({
  quantitaPronta: z.coerce.number().int("Numero intero").min(0, "Non può essere negativa"),
});

/** Consegna (anche di una parte): per ogni prodotto, quanti pezzi ritira il cliente. */
export const consegnaSchema = z.object({
  note: testoOpzionale,
  righe: z
    .array(z.object({ rigaId: z.string().min(1), quantita: z.coerce.number().int().min(0) }))
    // I prodotti a 0 nel modulo significano "di questo non consegno niente".
    .transform((r) => r.filter((x) => x.quantita > 0))
    .refine((r) => r.length > 0, "Indica almeno una quantità da consegnare"),
});
export type ConsegnaInput = z.infer<typeof consegnaSchema>;

/** Acconto: importo obbligatorio. Saldo ("ha pagato tutto"): importo facoltativo. */
export const pagamentoSchema = z
  .object({
    tipo: z.enum(["ACCONTO", "SALDO"]),
    importo: prezzoOpzionale,
    note: testoOpzionale,
  })
  // .refine aggiunge un controllo che riguarda più campi insieme; "path" dice sotto quale campo mostrare l'errore.
  .refine((p) => p.tipo === "SALDO" || p.importo !== null, {
    path: ["importo"],
    message: "Scrivi quanto ha lasciato di acconto",
  })
  .refine((p) => p.importo === null || Number(p.importo) > 0, {
    path: ["importo"],
    message: "L'importo deve essere maggiore di 0",
  });
export type PagamentoInput = z.infer<typeof pagamentoSchema>;

// -----------------------------------------------------------------------------
// Modulo del prodotto (una "riga" dell'ordine)
// -----------------------------------------------------------------------------

/** Un colore/taglia con la sua quantità. Mai null: "" vuol dire "nessun colore/taglia" (adesivi, pannelli). */
export const varianteSchema = z.object({
  colore: z.string().trim().max(50).default(""),
  taglia: z.string().trim().max(20).default(""),
  quantita: z.coerce.number().int("Quantità intera").positive("Quantità maggiore di 0"),
});

// Stampa e ricamo hanno dettagli diversi, salvati nel campo JSON "parametri".
const listaColori = z.array(z.string().trim().min(1)).max(30).default([]);
export const parametriStampaSchema = z.object({ colori: listaColori });
export const parametriRicamoSchema = z.object({
  coloriFili: listaColori,
  numeroPunti: z.coerce.number().int().positive().optional(),
});

const posizione = z.enum(["CUORE", "SPALLE", "MANICA", "ALTRO"]).nullable().default(null);

/**
 * Una lavorazione (stampa, ricamo...). "discriminatedUnion" = Zod sceglie lo
 * schema giusto guardando il campo "tecnica"; così TypeScript sa che se
 * tecnica è "RICAMO" allora parametri ha coloriFili.
 */
export const applicazioneSchema = z.discriminatedUnion("tecnica", [
  z.object({ tecnica: z.literal("STAMPA"), posizione, parametri: parametriStampaSchema, note: testoOpzionale }),
  z.object({ tecnica: z.literal("RICAMO"), posizione, parametri: parametriRicamoSchema, note: testoOpzionale }),
  z.object({ tecnica: z.literal("ALTRO"), posizione, parametri: z.null().default(null), note: testoOpzionale }),
]);

/** Stampa e ricamo solo sui capi (e su "Altro", il tipo jolly); adesivi, pannelli e gadget no. */
export const ammetteLavorazioni = (tipo: string) => tipo === "ABBIGLIAMENTO" || tipo === "ALTRO";

/** La taglia solo per l'abbigliamento (il colore invece vale per tutti). */
export const ammetteTaglie = (tipo: string) => tipo === "ABBIGLIAMENTO";

/** Il prodotto completo, mandato come oggetto dal modulo RigaForm. */
export const rigaSchema = z
  .object({
    descrizione: z.string().trim().min(1, "La descrizione è obbligatoria").max(200),
    tipo: z.enum(["ABBIGLIAMENTO", "ADESIVI", "PANNELLI", "GADGET", "ALTRO"]),
    // Articolo del magazzino (facoltativo): "" o assente = prodotto scritto a mano.
    articoloId: z
      .string()
      .nullish()
      .transform((s) => s || null),
    prezzoUnitario: prezzoOpzionale,
    note: testoOpzionale,
    varianti: z.array(varianteSchema).min(1, "Serve almeno una variante con la quantità"),
    applicazioni: z.array(applicazioneSchema).default([]),
  })
  // superRefine: controlli su tutto il prodotto, che possono segnalare più errori in punti diversi.
  .superRefine((riga, ctx) => {
    if (riga.applicazioni.length > 0 && !ammetteLavorazioni(riga.tipo)) {
      ctx.addIssue({
        code: "custom",
        path: ["applicazioni"],
        message: 'Stampa e ricamo si possono aggiungere solo all\'abbigliamento (o ad "Altro")',
      });
    }
    if (!ammetteTaglie(riga.tipo)) {
      riga.varianti.forEach((v, i) => {
        if (v.taglia !== "") {
          ctx.addIssue({
            code: "custom",
            path: ["varianti", i, "taglia"],
            message: 'La taglia si mette solo per l\'abbigliamento (o "Altro")',
          });
        }
      });
    }
    // Lo stesso colore e taglia due volte: lo vieterebbe anche il database
    // (@@unique), ma qui lo si dice prima e senza badare alle maiuscole ("Nero" = "nero").
    const viste = new Set<string>();
    riga.varianti.forEach((v, i) => {
      const chiave = chiaveVariante(v.colore, v.taglia);
      if (viste.has(chiave)) {
        ctx.addIssue({
          code: "custom",
          path: ["varianti", i, "taglia"],
          message: "Variante ripetuta (stesso colore e taglia)",
        });
      }
      viste.add(chiave);
    });
  });
export type RigaInput = z.infer<typeof rigaSchema>;
