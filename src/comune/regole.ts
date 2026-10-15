// =============================================================================
// comune/regole.ts — date, euro e campi dei moduli, usati da tutto il programma
// =============================================================================
// Funzioni "pure": non toccano il database, quindi funzionano sia sul server sia
// nel browser, e si testano facilmente (tests/regole.test.ts).

import type { Prisma } from "@prisma/client";
import { z } from "zod";

// -----------------------------------------------------------------------------
// Date
// -----------------------------------------------------------------------------
// Le scadenze sono GIORNI (@db.Date nello schema), non istanti: Prisma le
// restituisce come Date a mezzanotte UTC. Per non sbagliare giorno a causa del
// fuso orario, qui si lavora sempre con stringhe "AAAA-MM-GG".

const FUSO = "Europe/Rome";

/** Oggi in Italia, come "AAAA-MM-GG". */
export function oggiISO(adesso: Date = new Date()): string {
  // Il formato svedese ("sv-SE") scrive le date proprio come AAAA-MM-GG.
  return adesso.toLocaleDateString("sv-SE", { timeZone: FUSO });
}

/** Data salvata con @db.Date -> "AAAA-MM-GG" (legge la parte UTC, che è quella giusta). */
export function giornoISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** "AAAA-MM-GG" del modulo -> Date da salvare in un campo @db.Date. */
export function daGiornoISO(giorno: string): Date {
  return new Date(`${giorno}T00:00:00.000Z`);
}

/** Giorni da oggi alla data (negativo = già passata). */
export function giorniMancanti(giorno: string, oggi: string = oggiISO()): number {
  const ms = Date.parse(`${giorno}T00:00:00Z`) - Date.parse(`${oggi}T00:00:00Z`);
  return Math.round(ms / 86_400_000); // 86.400.000 = millisecondi in un giorno
}

/** Formato italiano di un giorno salvato (es. "lun 20/10/2026"). */
export function formattaGiorno(data: Date): string {
  return data.toLocaleDateString("it-IT", {
    timeZone: "UTC", // il giorno è salvato a mezzanotte UTC: lo si legge in UTC
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formato italiano di un istante (es. quando è stato creato un ordine o fatta una consegna). */
export function formattaDataOra(data: Date): string {
  return data.toLocaleString("it-IT", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// -----------------------------------------------------------------------------
// Euro
// -----------------------------------------------------------------------------

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** Decimal -> "8,50 €". toNumber() va bene SOLO per mostrare, mai per fare calcoli. */
export function formattaEuro(d: Prisma.Decimal) {
  return euro.format(d.toNumber());
}

// -----------------------------------------------------------------------------
// Campi dei moduli, per gli schemi Zod
// -----------------------------------------------------------------------------
// Un <input> manda sempre una stringa. Questi pezzi di schema la puliscono e la
// trasformano nel valore giusto per il database. Si usano negli schemi delle
// varie aree (clienti/regole.ts, ordini/regole.ts...).

/** Testo facoltativo: "" o soli spazi diventano null (nel database non vogliamo stringhe vuote). */
export const testoOpzionale = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .transform((s) => s ?? null);

/** Giorno "AAAA-MM-GG" dall'<input type="date">, oppure vuoto (= null). */
export const giornoOpzionale = z
  .string()
  .trim()
  .refine((s) => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s), "Data non valida")
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .transform((s) => s ?? null);

/** Casella da spuntare (checkbox): il browser manda "on" se è spuntata, niente se no. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

/**
 * Prezzo scritto dall'utente ("12,50" o "12.50") -> stringa "12.50" o null.
 * Resta una stringa: Prisma la converte in Decimal senza passare dai numeri
 * con la virgola del computer (che sbagliano gli arrotondamenti).
 */
export const prezzoOpzionale = z
  .string()
  .trim()
  .transform((s) => s.replace(",", "."))
  .refine((s) => s === "" || /^\d{1,8}(\.\d{1,2})?$/.test(s), "Prezzo non valido (es. 12,50)")
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .transform((s) => s ?? null);
