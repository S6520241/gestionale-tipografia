// =============================================================================
// comune/server.ts — strumenti che girano SOLO sul server
// =============================================================================
// Qui dentro:
//   1. db           il collegamento al database (Prisma)
//   2. ErroreUtente gli errori "previsti", con un messaggio da mostrare all'utente
//   3. Esito        cosa risponde una server action al modulo che l'ha chiamata
//   4. esegui()     esegue una modifica e trasforma gli errori previsti in un Esito
//   5. due aiuti per leggere i moduli HTML (FormData) e mostrare gli errori di Zod
//
// Non importarlo mai da un file "use client": contiene il client di Prisma, che
// nel browser non funziona (e non deve: il database si tocca solo dal server).
// Un file "use client" può però usare il TIPO Esito con `import type`, perché i
// tipi spariscono quando TypeScript viene tradotto in JavaScript.

import { Prisma, PrismaClient } from "@prisma/client";
import type { z } from "zod";

// -----------------------------------------------------------------------------
// 1. Database
// -----------------------------------------------------------------------------

// In sviluppo Next.js ricarica i file a ogni salvataggio: senza questo trucco
// si creerebbe un nuovo PrismaClient (con nuove connessioni a Postgres) ogni volta.
// Lo si conserva quindi in "globalThis", che sopravvive ai ricaricamenti.
const globalePerPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Il client di Prisma: si usa come `db.ordine.findMany(...)`, `db.cliente.create(...)`... */
export const db = globalePerPrisma.prisma ?? new PrismaClient();

// In produzione il server parte una volta sola, quindi il trucco non serve.
if (process.env.NODE_ENV !== "production") globalePerPrisma.prisma = db;

// -----------------------------------------------------------------------------
// 2. Errori previsti
// -----------------------------------------------------------------------------

/**
 * Errore "previsto", con un messaggio da mostrare all'utente
 * (es. "Non puoi consegnare più pezzi di quelli pronti").
 * Tutti gli altri errori sono bug e non vanno mostrati così come sono.
 */
export class ErroreUtente extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = "ErroreUtente";
  }
}

/** Traduce un errore in un messaggio per l'utente, oppure lo rilancia se è un bug. */
export function messaggioErrore(e: unknown): string {
  if (e instanceof ErroreUtente) return e.message;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // Errori del database che hanno un senso per l'utente.
    // Elenco dei codici: https://www.prisma.io/docs/orm/reference/error-reference
    if (e.code === "P2002") return "Esiste già un elemento con questi dati.";
    if (e.code === "P2003") return "Operazione bloccata: l'elemento è collegato ad altri dati.";
    if (e.code === "P2025") return "Elemento non trovato (forse è stato modificato da qualcun altro).";
  }
  throw e;
}

// -----------------------------------------------------------------------------
// 3-4. Risposta delle server action
// -----------------------------------------------------------------------------

/** Cosa restituisce una server action al modulo che l'ha chiamata. */
export type Esito = {
  ok?: boolean; // tutto andato bene
  errore?: string; // messaggio generale, mostrato vicino al bottone
  errori?: Record<string, string>; // errori per campo (dalla validazione Zod), mostrati sotto ogni campo
  // Valori inviati, per ri-mostrarli nel modulo in caso di errore: React 19
  // svuota il modulo dopo ogni action, e perdere quanto scritto è frustrante.
  valori?: Record<string, string>;
};

/**
 * Esegue una modifica e trasforma gli errori "previsti" in un Esito.
 * Gli errori imprevisti (bug) e i redirect di Next.js vengono rilanciati:
 * Next.js mostra la pagina di errore, invece di nascondere il problema.
 */
export async function esegui(fn: () => Promise<unknown>): Promise<Esito> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { errore: messaggioErrore(e) };
  }
}

// -----------------------------------------------------------------------------
// 5. Moduli HTML e Zod
// -----------------------------------------------------------------------------

/** FormData (quello che arriva da un <form>) -> oggetto semplice, da passare a schema.safeParse(). */
export function formDataInOggetto(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  // Si tengono solo i testi: i file caricati (File) qui non servono.
  for (const [k, v] of fd.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}

/** Errori di Zod -> { campo: "messaggio" }, da mostrare sotto i campi del modulo. */
export function erroriPerCampo(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    // Il "percorso" del campo, es. ["varianti", 0, "taglia"] -> "varianti.0.taglia".
    // "_" se l'errore riguarda tutto l'oggetto e non un campo preciso.
    const chiave = issue.path.join(".") || "_";
    out[chiave] ??= issue.message; // per ogni campo basta il primo errore
  }
  return out;
}
