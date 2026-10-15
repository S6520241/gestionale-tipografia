// =============================================================================
// /ordini — elenco degli ordini, con filtri e ricerca
// =============================================================================
// ?filtro=...  quale "pillola" è scelta (vedi FILTRI; senza = "Da fare")
// ?q=...       cliente o numero d'ordine cercato

import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants, cn, Input, TitoloPagina } from "@/comune/componenti";
import { giorniAllaConsegna, isOrdineAperto } from "@/ordini/calcoli";
import { ElencoOrdini } from "@/ordini/componenti";
import { elencoOrdini, type OrdineInElenco } from "@/ordini/database";

export const metadata: Metadata = { title: "Ordini" };

/** Giorni alla consegna di un ordine (negativo = in ritardo, null = senza data). */
const giorni = (o: OrdineInElenco) => giorniAllaConsegna(o.dataConsegna);

// Ogni filtro: nome mostrato + regola per scegliere gli ordini. "archiviati" li legge a parte dal database.
const FILTRI = {
  aperti: { testo: "Da fare", regola: (o: OrdineInElenco) => isOrdineAperto(o.stato) },
  ritardo: { testo: "In ritardo", regola: (o: OrdineInElenco) => isOrdineAperto(o.stato) && (giorni(o) ?? 0) < 0 },
  oggi: {
    testo: "Oggi e domani",
    regola: (o: OrdineInElenco) => isOrdineAperto(o.stato) && (giorni(o) === 0 || giorni(o) === 1),
  },
  pronti: { testo: "Pronti", regola: (o: OrdineInElenco) => o.stato === "PRONTO" },
  chiusi: { testo: "Ritirati / annullati", regola: (o: OrdineInElenco) => !isOrdineAperto(o.stato) },
  tutti: { testo: "Tutti", regola: () => true },
  archiviati: { testo: "Archiviati", regola: () => true },
} as const;
type Filtro = keyof typeof FILTRI;

export default async function OrdiniPage({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  const { q, filtro: f } = await searchParams;
  // Un filtro sconosciuto nell'indirizzo vale come "aperti".
  const filtro: Filtro = f && f in FILTRI ? (f as Filtro) : "aperti";

  // Gli archiviati si leggono solo se servono (Promise.resolve([]) = "niente", subito).

  const [tutti, archiviati] = await Promise.all([
    elencoOrdini({ cerca: q }),
    filtro === "archiviati" ? elencoOrdini({ cerca: q, archiviati: true }) : Promise.resolve([]),
  ]);
  const ordini = filtro === "archiviati" ? archiviati : tutti.filter(FILTRI[filtro].regola);

  return (
    <div>
      <TitoloPagina titolo="Ordini" sottotitolo="Tocca un ordine per vederlo e aggiornarlo." />

      <form className="relative mb-4 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <input type="hidden" name="filtro" value={filtro} />
        <Input name="q" defaultValue={q} placeholder="Cerca per cliente o numero (es. 15)" className="pl-12" />
      </form>

      {/* Filtri come "pillole" con il conteggio: si vede subito quanti sono. */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(FILTRI) as Filtro[]).map((k) => {
          const n = k === "archiviati" ? null : tutti.filter(FILTRI[k].regola).length;
          return (
            <Link
              key={k}
              href={{ query: { filtro: k, ...(q ? { q } : {}) } }}
              className={cn(
                buttonVariants({ variant: k === filtro ? "default" : "outline", size: "sm" }),
                "h-10 rounded-full px-4",
              )}
            >
              {FILTRI[k].testo}
              {n !== null && (
                <span
                  className={cn(
                    "rounded-full px-2 text-xs",
                    k === filtro ? "bg-white/25" : "bg-muted text-muted-foreground",
                  )}
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <ElencoOrdini ordini={ordini} vuoto="Nessun ordine qui." />
    </div>
  );
}
