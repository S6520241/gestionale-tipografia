// =============================================================================
// auth.ts — login e sessione (Auth.js, cioè next-auth v5)
// =============================================================================
// Come funziona l'accesso:
//   1. nella pagina /login l'utente scrive email e password;
//   2. Auth.js chiama authorize() qui sotto, che le controlla nel database;
//   3. se vanno bene, Auth.js crea un "JWT": un biglietto firmato con AUTH_SECRET
//      (dal file .env) e salvato in un cookie del browser. Niente tabelle di
//      sessione nel database: il biglietto basta, e nessuno può falsificarlo
//      senza conoscere AUTH_SECRET;
//   4. a ogni pagina src/proxy.ts chiama authorized() qui sotto, che controlla il
//      biglietto e rilegge l'utente dal database (disattivato? password cambiata?);
//   5. le server action chiamano utenteCorrente() (in fondo al file) per lo stesso controllo.

import NextAuth, { type DefaultSession } from "next-auth";
// Solo per i tipi: serve perché "declare module "next-auth/jwt"" qui sotto trovi il modulo.
import type {} from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/comune/server";
import { verificaCredenziali } from "@/utenti/database";
import { statoAccesso } from "@/utenti/regole";

// -----------------------------------------------------------------------------
// Campi in più nella sessione e nel biglietto (JWT)
// -----------------------------------------------------------------------------
// Di serie Auth.js mette nella sessione solo nome, email e immagine. Qui si dice
// a TypeScript che ci sono anche l'id dell'utente e l'ora del login
// ("declare module" aggiunge campi ai tipi di una libreria).

declare module "next-auth" {
  interface Session {
    user: { id: string; loginIl?: number } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Quando è stato fatto l'accesso (ms): serve per far uscire da tutti i dispositivi. */
    loginIl?: number;
  }
}

// -----------------------------------------------------------------------------
// Configurazione di Auth.js
// -----------------------------------------------------------------------------

// Cosa deve arrivare dal modulo di login.
const credenzialiSchema = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(1),
});

// NextAuth() restituisce le funzioni che si usano nel resto del programma:
//   handlers      le pagine /api/auth/... (src/app/api/auth/[...nextauth]/route.ts)
//   auth()        legge la sessione dell'utente (o null se non ha fatto l'accesso)
//   signIn()      fa entrare (usata dalle server action di login e registrazione)
//   signOut()     fa uscire (bottone "Esci")
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Dietro un proxy/hosting serve per fidarsi dell'indirizzo del sito (header Host).
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 giorni: è un PC di negozio
  pages: { signIn: "/login" }, // chi non ha fatto l'accesso finisce qui
  providers: [
    // "Credentials" = login con email e password nostre (non "Accedi con Google").
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credenzialiSchema.safeParse(raw);
        if (!parsed.success) return null;

        // Stesso messaggio se l'email non esiste, la password è sbagliata o l'utente
        // è disattivato: non si rivela quali email sono registrate.
        const utente = await verificaCredenziali(parsed.data.email, parsed.data.password);
        if (!utente) return null;

        return { id: utente.id, name: utente.name, email: utente.email };
      },
    }),
  ],
  callbacks: {
    // Chiamato da proxy.ts prima di ogni pagina: chi non può entrare va al login.
    // Si rilegge l'utente dal database a ogni pagina: chi viene disattivato, o a cui
    // cambiano la password, esce subito da tutti i dispositivi.
    async authorized({ auth, request }) {
      const percorso = request.nextUrl.pathname;
      // Login e registrazione restano sempre raggiungibili (anche con una sessione scaduta o disattivata).
      if (percorso.startsWith("/login") || percorso.startsWith("/registrati")) return true;
      if (!auth?.user?.id) return false; // false = vai alla pagina di login
      const utente = await db.user.findUnique({
        where: { id: auth.user.id },
        select: { attivo: true, devoCambiarePassword: true, sessioniValideDal: true },
      });
      const stato = statoAccesso(utente, auth.user.loginIl);
      if (stato === "FUORI") return false;
      // Password temporanea: prima di tutto il resto deve sceglierne una sua.
      if (stato === "CAMBIA_PASSWORD" && !percorso.startsWith("/profilo"))
        // Next.js rende relativo l'indirizzo: dal telefono (http://IP-DEL-PC:3000) si resta sullo stesso host.
        return Response.redirect(new URL("/profilo", request.nextUrl));
      return true;
    },
    // Mette l'id dell'utente nel biglietto (di serie ci sono solo nome ed email).
    // "user" c'è solo al momento dell'accesso: lì si segna anche l'ora del login.
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id; // "sub" (subject) è il campo standard per l'id
        token.loginIl = Date.now();
      }
      return token;
    },
    // Dal biglietto alla sessione che leggono le pagine con auth().
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.loginIl = token.loginIl;
      return session;
    },
  },
});

// -----------------------------------------------------------------------------
// Utente corrente, per le server action e le pagine
// -----------------------------------------------------------------------------

/**
 * Utente che ha fatto l'accesso: da chiamare all'inizio di ogni server action.
 * Il proxy protegge le PAGINE, ma una server action è un indirizzo che si può
 * chiamare anche da fuori: il controllo va ripetuto qui.
 * Si rilegge l'utente dal database, così un utente disattivato perde subito l'accesso.
 * Chi ha una password temporanea può solo cambiarla (opzione ancheConPasswordTemporanea).
 * redirect() interrompe tutto e manda il browser a un'altra pagina.
 */
export async function utenteCorrente(opzioni: { ancheConPasswordTemporanea?: boolean } = {}) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  const utente = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, attivo: true, devoCambiarePassword: true, sessioniValideDal: true },
  });
  const stato = statoAccesso(utente, session.user.loginIl);
  if (stato === "FUORI") redirect("/login");
  if (stato === "CAMBIA_PASSWORD" && !opzioni.ancheConPasswordTemporanea) redirect("/profilo");
  return utente!; // "!": qui utente non può essere null (statoAccesso avrebbe detto FUORI)
}
