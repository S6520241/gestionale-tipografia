"use server";

// =============================================================================
// utenti/azioni.ts — server action di accesso, registrazione, account e utenti
// =============================================================================
// "use server" (prima riga): ogni funzione esportata qui è una "server action",
// cioè una funzione che gira sul server ma si può chiamare da un modulo nel
// browser (es. <form action={accedi}>). Next.js fa da solo la richiesta al server.
//
// Ogni azione segue lo stesso schema:
//   1. chi è l'utente (utenteCorrente) — tranne login e registrazione, che sono pubblici;
//   2. controllo dei dati con Zod;
//   3. la modifica vera, in utenti/database.ts;
//   4. revalidatePath(): la pagina si ridisegna con i dati nuovi.

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, utenteCorrente } from "@/auth";
import { db, erroriPerCampo, type Esito, esegui, formDataInOggetto } from "@/comune/server";
import * as utenti from "./database";
import { cambioPasswordSchema, registrazioneSchema } from "./regole";

// -----------------------------------------------------------------------------
// Accesso e registrazione (pagine /login e /registrati)
// -----------------------------------------------------------------------------

type EsitoLogin = { errore?: string; email?: string };

/** Modulo di login. In caso di errore rimanda l'email scritta, così non va riscritta. */
export async function accedi(_prev: EsitoLogin, fd: FormData): Promise<EsitoLogin> {
  const email = String(fd.get("email") ?? "");
  try {
    // redirect: false -> signIn imposta il cookie senza saltare a un'altra pagina,
    // così qui sotto si decide dove andare.
    await signIn("credentials", { email, password: fd.get("password"), redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { errore: "Email o password non corrette", email };
    throw e;
  }
  // Con una password temporanea si va subito a sceglierne una nuova.
  const utente = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  redirect(utente?.devoCambiarePassword ? "/profilo" : "/");
}

/** Modulo "Crea il tuo account": crea l'utente e lo fa entrare subito. */
export async function registrati(_prev: Esito, fd: FormData): Promise<Esito> {
  const valori = formDataInOggetto(fd);
  const parsed = registrazioneSchema.safeParse(valori);
  // Le password non tornano indietro nel modulo: si riscrivono.
  const daRimostrare = { nome: valori.nome ?? "", email: valori.email ?? "", codice: valori.codice ?? "" };
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error), valori: daRimostrare };

  const esito = await esegui(() => utenti.registra(parsed.data));
  if (esito.errore) return { ...esito, valori: daRimostrare };

  // Account creato: si entra subito (signIn fa un redirect alla pagina Oggi).
  await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirectTo: "/" });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Il mio account (pagina /profilo)
// -----------------------------------------------------------------------------

/** Modulo "Cambia password". */
export async function cambiaLaMiaPassword(_prev: Esito, fd: FormData): Promise<Esito> {
  // Anche chi ha una password temporanea deve poter arrivare fin qui (è l'unica cosa che può fare).
  const io = await utenteCorrente({ ancheConPasswordTemporanea: true });
  const parsed = cambioPasswordSchema.safeParse(formDataInOggetto(fd));
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error) };

  const email = await utenti.cambiaPassword(io.id, parsed.data.attuale, parsed.data.nuova);
  if (!email) return { errori: { attuale: "Password attuale non corretta" } };

  // Il cambio fa uscire da tutti i dispositivi: su questo si rientra subito con la password nuova.
  await signIn("credentials", {
    email,
    password: parsed.data.nuova,
    redirectTo: io.devoCambiarePassword ? "/" : "/profilo?cambiata=1",
  });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Utenti e codici invito (pagina /utenti)
// -----------------------------------------------------------------------------

/** Come Esito, ma con un valore da mostrare (la password temporanea appena creata). */
export type EsitoConValore = Esito & { valore?: string };

/** Bottone "Crea codice invito". */
export async function creaInvito(): Promise<Esito> {
  const io = await utenteCorrente();
  const esito = await esegui(() => utenti.creaCodiceInvito(io.id));
  revalidatePath("/utenti");
  return esito;
}

/** Bottone "Annulla codice". */
export async function annullaInvito(id: string): Promise<Esito> {
  await utenteCorrente();
  const esito = await esegui(() => utenti.annullaCodiceInvito(id));
  revalidatePath("/utenti");
  return esito;
}

/** Bottone "Password dimenticata": restituisce la password temporanea da dettare. */
export async function passwordTemporanea(utenteId: string): Promise<EsitoConValore> {
  const io = await utenteCorrente();
  let valore = "";
  const esito = await esegui(async () => {
    valore = await utenti.impostaPasswordTemporanea(utenteId, io.id);
  });
  revalidatePath("/utenti");
  return esito.errore ? esito : { ok: true, valore };
}

/** Bottoni "Disattiva" e "Riattiva". */
export async function attivaUtente(utenteId: string, attivo: boolean): Promise<Esito> {
  const io = await utenteCorrente();
  const esito = await esegui(() => utenti.impostaUtenteAttivo(utenteId, attivo, io.id));
  revalidatePath("/utenti");
  return esito;
}
