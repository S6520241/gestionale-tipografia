// =============================================================================
// /profilo — "Il mio account": nome, email e cambio password
// =============================================================================
// Con una password temporanea si può entrare solo qui (lo controlla utenteCorrente
// in src/auth.ts), finché non se ne sceglie una propria.

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { utenteCorrente } from "@/auth";
import { Avatar, Card, CardContent, CardHeader, CardTitle, TitoloPagina } from "@/comune/componenti";
import { CambioPasswordForm } from "@/utenti/moduli";

export const metadata: Metadata = { title: "Il mio account" };

export default async function ProfiloPage({ searchParams }: { searchParams: Promise<{ cambiata?: string }> }) {
  const io = await utenteCorrente({ ancheConPasswordTemporanea: true });
  const { cambiata } = await searchParams; // ?cambiata=1 dopo il cambio password
  const nome = io.name ?? io.email;

  return (
    <div className="grid max-w-3xl gap-5">
      <TitoloPagina className="mb-0" titolo="Il mio account" />

      {io.devoCambiarePassword && (
        <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-lg font-semibold text-amber-900">
          Stai usando una password temporanea che ti ha dato un collega. Scegline una tua per continuare.
        </p>
      )}
      {cambiata && (
        <p className="rounded-2xl bg-emerald-100 p-4 font-semibold text-emerald-800">
          ✓ Password cambiata. Sugli altri dispositivi dovrai rientrare con quella nuova.
        </p>
      )}

      <Card className="flex items-center gap-4 p-5">
        <Avatar nome={nome} />
        <div>
          <div className="text-lg font-bold">{nome}</div>
          <div className="text-muted-foreground">{io.email}</div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambia password</CardTitle>
        </CardHeader>
        <CardContent>
          <CambioPasswordForm temporanea={io.devoCambiarePassword} />
        </CardContent>
      </Card>

      {!io.devoCambiarePassword && (
        <Link
          href="/utenti"
          className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/40"
        >
          <Users className="size-6 text-primary" />
          <div className="flex-1">
            <div className="font-bold">Utenti e codici invito</div>
            <div className="text-sm text-muted-foreground">
              Fai entrare una persona nuova, dai una password temporanea a chi l&apos;ha dimenticata.
            </div>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
