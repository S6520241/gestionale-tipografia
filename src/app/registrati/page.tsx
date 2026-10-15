// =============================================================================
// /registrati — creazione di un account (il primo, o con un codice invito)
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { SchermataAccesso } from "@/comune/componenti";
import { ciSonoUtenti } from "@/utenti/database";
import { RegistratiForm } from "@/utenti/moduli";

export const metadata: Metadata = { title: "Crea account" };
export const dynamic = "force-dynamic";

// ?codice=ABCD-EFGH: il codice già scritto nel modulo (es. da un link mandato su WhatsApp).
// searchParams = i parametri dopo il "?" nell'indirizzo.
export default async function RegistratiPage({ searchParams }: { searchParams: Promise<{ codice?: string }> }) {
  const { codice } = await searchParams;
  const primo = !(await ciSonoUtenti()); // nessun utente: questo sarà il primo, senza codice
  return (
    <SchermataAccesso
      sottotitolo={
        primo
          ? "Crea il primo account. Poi, dalla pagina Utenti, potrai invitare i colleghi."
          : "Crea il tuo account con il codice invito che ti ha dato un collega."
      }
    >
      <RegistratiForm primo={primo} codice={codice} />
      {!primo && (
        <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
          Hai già un account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Entra
          </Link>
        </p>
      )}
    </SchermataAccesso>
  );
}
