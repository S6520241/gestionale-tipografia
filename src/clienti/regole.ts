// =============================================================================
// clienti/regole.ts — com'è fatto un cliente valido
// =============================================================================
// Lo schema Zod del modulo cliente. Funziona sul server e nel browser,
// testato in tests/regole.test.ts.

import { z } from "zod";
import { testoOpzionale } from "@/comune/regole";

/**
 * Pochi campi obbligatori: meglio un cliente incompleto che nessun cliente.
 * I campi vuoti diventano null (vedi testoOpzionale); email e partita IVA
 * si controllano solo se sono scritte.
 */
export const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Il nome è obbligatorio").max(200),
  telefono: testoOpzionale,
  email: testoOpzionale.refine((s) => s === null || z.email().safeParse(s).success, "Email non valida"),
  partitaIva: testoOpzionale.refine((s) => s === null || /^\d{11}$/.test(s), "La partita IVA ha 11 cifre"),
  codiceFiscale: testoOpzionale.transform((s) => s?.toUpperCase() ?? null),
  note: testoOpzionale,
});

/** Il tipo TypeScript dei dati già controllati, ricavato dallo schema. */
export type ClienteInput = z.infer<typeof clienteSchema>;
