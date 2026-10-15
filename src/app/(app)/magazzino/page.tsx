// =============================================================================
// /magazzino — elenco degli articoli con i pezzi disponibili
// =============================================================================
// ?q=...          testo cercato (articolo o colore)
// ?categoria=...  solo gli articoli di una categoria (i bottoni-filtro in alto)

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, PackagePlus, Search } from "lucide-react";
import { buttonVariants, cn, Input, TitoloPagina } from "@/comune/componenti";
import { coloreGiacenza, GrigliaGiacenza } from "@/magazzino/componenti";
import { categorieArticoli, elencoArticoli } from "@/magazzino/database";

export const metadata: Metadata = { title: "Magazzino" };

/** Quanti colori diversi ha un articolo. */
const nColori = (varianti: { colore: string }[]) => new Set(varianti.map((v) => v.colore)).size;

export default async function MagazzinoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const { q, categoria } = await searchParams;
  const [articoli, categorie] = await Promise.all([elencoArticoli({ cerca: q, categoria }), categorieArticoli()]);
  // Con una ricerca mostriamo subito la tabella colori x taglie; senza, solo i totali (sono tanti).
  const dettaglio = Boolean(q) || articoli.length <= 6;
  // Indirizzo di un bottone-filtro: tiene la ricerca e cambia solo la categoria (g = undefined -> "Tutti").
  const link = (g?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (g) p.set("categoria", g);
    return `/magazzino${p.size ? `?${p}` : ""}`;
  };

  return (
    <div>
      <TitoloPagina
        titolo="Magazzino"
        sottotitolo="Quanti pezzi ci sono, per colore e taglia. Tocca un articolo per aggiungere merce o correggere."
        azioni={
          <Link href="/magazzino/nuovo" className={buttonVariants({ size: "lg" })}>
            <PackagePlus /> Nuovo articolo
          </Link>
        }
      />

      <form className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Cerca articolo o colore (es. polo, nero)" className="pl-12" />
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        {/* undefined = il bottone "Tutti", poi uno per categoria. */}
        {[undefined, ...categorie].map((c) => (
          <Link
            key={c ?? "tutti"}
            href={link(c)}
            className={cn(
              "rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold",
              categoria === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
            )}
          >
            {c ?? "Tutti"}
          </Link>
        ))}
      </div>

      <div className="grid gap-3">
        {articoli.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed p-10 text-center text-lg text-muted-foreground">
            {q ? `Nessun articolo trovato per “${q}”.` : "Nessun articolo."}
          </p>
        )}
        {articoli.map((a) => (
          <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <Link href={`/magazzino/${a.id}`} className="flex items-center gap-3 hover:text-primary">
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold">{a.nome}</div>
                <div className="text-sm text-muted-foreground">
                  {a.categoria ?? "Senza categoria"} · {nColori(a.varianti)}{" "}
                  {nColori(a.varianti) === 1 ? "colore" : "colori"}
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full bg-muted px-3 py-1 font-bold whitespace-nowrap tabular-nums",
                  coloreGiacenza(a.totale),
                )}
              >
                {a.totale} pz
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
            {dettaglio && (
              <div className="mt-3">
                <GrigliaGiacenza varianti={a.varianti} compatta />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
