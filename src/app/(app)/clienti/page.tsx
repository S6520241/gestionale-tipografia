// =============================================================================
// /clienti — elenco dei clienti, con ricerca
// =============================================================================
// ?q=...         testo cercato
// ?archiviati=1  mostra i clienti archiviati invece di quelli attivi

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { elencoClienti } from "@/clienti/database";
import { Avatar, buttonVariants, cn, Input, TitoloPagina } from "@/comune/componenti";

export const metadata: Metadata = { title: "Clienti" };

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archiviati?: string }>;
}) {
  const { q, archiviati } = await searchParams;
  const mostraArchiviati = archiviati === "1";
  const clienti = await elencoClienti({ cerca: q, archiviati: mostraArchiviati });

  return (
    <div>
      <TitoloPagina
        titolo={mostraArchiviati ? "Clienti archiviati" : "Clienti"}
        sottotitolo="Tocca un cliente per vedere i suoi ordini e i suoi dati."
        azioni={
          <Link href="/clienti/nuovo" className={buttonVariants({ size: "lg" })}>
            <UserPlus /> Nuovo cliente
          </Link>
        }
      />

      {/* Modulo senza action: invia con GET, quindi la ricerca finisce nell'URL (?q=...)
          e si può tornare indietro con il browser. Si invia premendo Invio. */}
      <form className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Cerca per nome, telefono o email" className="pl-12" />
        {mostraArchiviati && <input type="hidden" name="archiviati" value="1" />}
      </form>

      <div className="grid gap-3">
        {clienti.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed p-10 text-center text-lg text-muted-foreground">
            {q ? `Nessun cliente trovato per “${q}”.` : "Nessun cliente."}
          </p>
        )}
        {clienti.map((c) => (
          <Link
            key={c.id}
            href={`/clienti/${c.id}`}
            className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <Avatar nome={c.nome} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold">{c.nome}</div>
              <div className="truncate text-muted-foreground">
                {[c.telefono, c.email].filter(Boolean).join(" · ") || "Nessun contatto"}
              </div>
            </div>
            {/* _count.ordini: quanti ordini ha, contati dal database (vedi elencoClienti). */}
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold whitespace-nowrap">
              {c._count.ordini} {c._count.ordini === 1 ? "ordine" : "ordini"}
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <Link
        href={mostraArchiviati ? "/clienti" : "/clienti?archiviati=1"}
        className={cn(buttonVariants({ variant: "link" }), "mt-4 px-0")}
      >
        {mostraArchiviati ? "← Torna ai clienti attivi" : "Vedi i clienti archiviati"}
      </Link>
    </div>
  );
}
