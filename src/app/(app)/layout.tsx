// =============================================================================
// app/(app)/layout.tsx — la cornice di tutte le pagine dopo il login
// =============================================================================
// Computer: menu a sinistra. Telefono: barra in alto con il logo e menu in basso.
// (Il gruppo "(app)" non compare nell'URL: /ordini, non /(app)/ordini.)
// Chi non ha fatto il login non arriva qui: lo rimanda a /login il proxy (src/proxy.ts).

import Link from "next/link";
import { CircleUserRound, LogOut, Users } from "lucide-react";
import { auth, signOut } from "@/auth";
import { NOME_AZIENDA, SIGLA_AZIENDA } from "@/comune/azienda";
import { NavInBasso, NavLaterale } from "@/comune/moduli";

/** Il quadratino con la sigla e il nome dell'azienda, che riporta alla pagina Oggi. */
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-base font-black text-white shadow-sm">
        {SIGLA_AZIENDA}
      </span>
      <span className="text-lg font-extrabold tracking-tight">{NOME_AZIENDA}</span>
    </Link>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Server action scritta direttamente qui: "use server" dentro la funzione.
  async function esci() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  // Lo stesso bottone "Esci" serve in due posti (barra laterale e barra in alto).
  const bottoneEsci = (
    <form action={esci}>
      <button className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
        <LogOut className="size-4" /> Esci
      </button>
    </form>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Computer: barra laterale fissa */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r bg-card p-5 lg:flex">
        <Logo />
        <NavLaterale />
        <div className="mt-auto grid gap-1 border-t pt-4">
          <Link
            href="/profilo"
            className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-accent"
          >
            <CircleUserRound className="size-4" /> {session?.user?.name ?? "Il mio account"}
          </Link>
          <Link
            href="/utenti"
            className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Users className="size-4" /> Utenti e inviti
          </Link>
          {bottoneEsci}
        </div>
      </aside>

      {/* Telefono: barra in alto */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/95 px-4 py-2 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <Link
            href="/profilo"
            aria-label="Il mio account"
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <CircleUserRound className="size-6" />
          </Link>
          {bottoneEsci}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      <NavInBasso />
    </div>
  );
}
