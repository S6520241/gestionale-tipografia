// =============================================================================
// /login — pagina di accesso
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants, SchermataAccesso } from "@/comune/componenti";
import { ciSonoUtenti } from "@/utenti/database";
import { LoginForm } from "@/utenti/moduli";

export const metadata: Metadata = { title: "Accedi" };
// Dipende dal database (ci sono utenti?): la pagina si prepara a ogni visita, non una volta per tutte.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Programma appena installato: nessuno può entrare, si crea il primo account.
  if (!(await ciSonoUtenti()))
    return (
      <SchermataAccesso sottotitolo="Benvenuto! Non c'è ancora nessun utente: crea il primo account.">
        <Link href="/registrati" className={buttonVariants({ size: "xl", className: "w-full" })}>
          Crea il primo account
        </Link>
      </SchermataAccesso>
    );

  return (
    <SchermataAccesso sottotitolo="Ciao! Inserisci email e password per entrare.">
      <LoginForm />
      <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
        Sei nuovo e hai un codice invito?{" "}
        <Link href="/registrati" className="font-semibold text-primary hover:underline">
          Crea il tuo account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Password dimenticata? Chiedi a un collega di darti una password temporanea.
      </p>
    </SchermataAccesso>
  );
}
