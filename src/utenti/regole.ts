// =============================================================================
// utenti/regole.ts — regole di accesso, codici invito e password
// =============================================================================
// Niente database: funzioni e schemi Zod che funzionano sia sul server sia nel
// browser. Testati in tests/regole.test.ts.
//
// Come si entra nel programma (vedi anche utenti/database.ts):
//   - tutti gli utenti hanno gli stessi permessi;
//   - per creare un account serve un codice invito, creato da un collega
//     nella pagina Utenti (tranne il primissimo utente);
//   - chi dimentica la password riceve da un collega una password temporanea,
//     che al primo accesso deve cambiare.

import { z } from "zod";
import { NOME_AZIENDA } from "@/comune/azienda";

// -----------------------------------------------------------------------------
// Codici invito
// -----------------------------------------------------------------------------

/** Caratteri dei codici: niente 0/O, 1/I/L, che al telefono o scritti a mano si confondono. */
export const ALFABETO_CODICE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LUNGHEZZA_CODICE = 8;
export const GIORNI_VALIDITA_INVITO = 7;

/** Quello che l'utente scrive ("abcd efgh", "ABCD-EFGH") -> "ABCDEFGH". */
export const normalizzaCodice = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** "ABCDEFGH" -> "ABCD-EFGH": più facile da leggere e dettare. */
export const formattaCodice = (s: string) => (s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s);

/**
 * Codice casuale. "casuale" riceve n e restituisce un intero tra 0 e n-1:
 * sul server è crypto.randomInt (davvero imprevedibile), nei test una funzione finta.
 */
export function generaCodice(casuale: (n: number) => number, lunghezza = LUNGHEZZA_CODICE) {
  let s = "";
  for (let i = 0; i < lunghezza; i++) s += ALFABETO_CODICE[casuale(ALFABETO_CODICE.length)];
  return s;
}

// -----------------------------------------------------------------------------
// Chi può entrare
// -----------------------------------------------------------------------------

/** I campi dell'utente che servono per decidere se può entrare. */
export type DatiAccesso = { attivo: boolean; devoCambiarePassword: boolean; sessioniValideDal: Date | null };

/**
 * Cosa può fare chi ha fatto l'accesso al momento "loginIl" (in millisecondi):
 *  - FUORI: utente disattivato, oppure l'accesso è precedente a un cambio password
 *    o a una password temporanea (si esce da tutti i dispositivi);
 *  - CAMBIA_PASSWORD: ha una password temporanea, prima deve sceglierne una sua;
 *  - ENTRA: tutto ok.
 * Si usa in src/auth.ts (a ogni pagina e a ogni server action).
 */
export function statoAccesso(
  u: DatiAccesso | null,
  loginIl: number | undefined,
): "ENTRA" | "CAMBIA_PASSWORD" | "FUORI" {
  if (!u || !u.attivo) return "FUORI";
  if (u.sessioniValideDal && (loginIl ?? 0) < u.sessioniValideDal.getTime()) return "FUORI";
  return u.devoCambiarePassword ? "CAMBIA_PASSWORD" : "ENTRA";
}

// -----------------------------------------------------------------------------
// Password e moduli (schemi Zod)
// -----------------------------------------------------------------------------
// Uno schema Zod descrive com'è fatto un dato valido. schema.safeParse(dati)
// controlla i dati e, se va bene, li restituisce già puliti (es. email minuscola);
// se no, restituisce gli errori con il messaggio da mostrare sotto ogni campo.

// Password troppo facili da indovinare: le rifiutiamo anche se lunghe 8 caratteri.
const PASSWORD_DEBOLI = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "qwertyui",
  "qwerty123",
  "abcdefgh",
  "abcd1234",
  "iloveyou",
  "cambiami",
  "cambiami123",
  // Il nome dell'azienda è la prima password che viene in mente a tutti.
  ...[NOME_AZIENDA.toLowerCase(), NOME_AZIENDA.toLowerCase().replace(/\s+/g, "")].flatMap((n) => [
    n,
    `${n}1`,
    `${n}123`,
  ]),
]);

/** Regole della password: almeno 8 caratteri, non una di quelle ovvie. */
export const passwordNuova = z
  .string()
  .min(8, "Almeno 8 caratteri")
  // bcrypt usa solo i primi 72 byte: oltre non servirebbe a niente.
  .max(64, "Al massimo 64 caratteri")
  .refine((s) => !PASSWORD_DEBOLI.has(s.toLowerCase()), "Troppo facile da indovinare, scegline un'altra")
  // Almeno 3 caratteri diversi: "aaaaaaaa" o "abababab" non vanno bene.
  .refine((s) => new Set(s).size > 2, "Troppo facile da indovinare, scegline un'altra");

/** Email: spazi tolti e tutto minuscolo, così "Marco@Negozio.it" e "marco@negozio.it" sono la stessa. */
const email = z.string().trim().toLowerCase().pipe(z.email("Email non valida"));

/** Modulo "Crea il tuo account". */
export const registrazioneSchema = z
  .object({
    nome: z.string().trim().min(1, "Scrivi il tuo nome").max(80),
    email,
    password: passwordNuova,
    conferma: z.string(),
    codice: z.string().trim().default(""), // vuoto solo per il primo utente
  })
  // .refine controlla più campi insieme; "path" dice sotto quale campo mostrare l'errore.
  .refine((d) => d.password === d.conferma, { path: ["conferma"], message: "Le due password non sono uguali" })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0]), {
    path: ["password"],
    message: "Non usare la tua email nella password",
  });
export type RegistrazioneInput = z.infer<typeof registrazioneSchema>; // il tipo TypeScript ricavato dallo schema

/** Modulo "Cambia password" nella pagina Il mio account. */
export const cambioPasswordSchema = z
  .object({
    attuale: z.string().min(1, "Scrivi la password che usi adesso"),
    nuova: passwordNuova,
    conferma: z.string(),
  })
  .refine((d) => d.nuova === d.conferma, { path: ["conferma"], message: "Le due password non sono uguali" })
  .refine((d) => d.nuova !== d.attuale, { path: ["nuova"], message: "Deve essere diversa da quella di adesso" });
