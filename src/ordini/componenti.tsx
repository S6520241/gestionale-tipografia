// =============================================================================
// ordini/componenti.tsx — badge, scadenze, barre e schede degli ordini
// =============================================================================
// Pezzi senza interazione (disegnati sul server), usati dalle pagine Oggi,
// Ordini, Cliente e Ordine.

import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { Badge, cn } from "@/comune/componenti";
import { formattaEuro, formattaGiorno } from "@/comune/regole";
import {
  formattaNumeroOrdine,
  isOrdineAperto,
  type RiepilogoPagamento,
  type StatoOrdine,
  type StatoRigaMostrato,
  urgenzaScadenza,
} from "./calcoli";
import type { OrdineInElenco } from "./database";
import { STATO_ORDINE, STATO_RIGA_MOSTRATO } from "./regole";

// -----------------------------------------------------------------------------
// Badge
// -----------------------------------------------------------------------------

export function BadgeStatoOrdine({ stato, grande }: { stato: StatoOrdine; grande?: boolean }) {
  const s = STATO_ORDINE[stato];
  return (
    <Badge colore={s.colore} grande={grande}>
      {s.testo}
    </Badge>
  );
}

export function BadgeStatoRiga({ stato, grande }: { stato: StatoRigaMostrato; grande?: boolean }) {
  const s = STATO_RIGA_MOSTRATO[stato];
  return (
    <Badge colore={s.colore} grande={grande}>
      {s.testo}
    </Badge>
  );
}

export function BadgeUrgente() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
      <Flame className="size-3.5" /> Urgente
    </span>
  );
}

/**
 * Pagamento in un badge: verde pagato, ambra acconto, grigio non pagato.
 * Con "evidenzia" (ordine pronto o ritirato) un non pagato diventa rosso: ci sono soldi da incassare.
 */
export function BadgePagamento({
  p,
  grande,
  evidenzia,
}: {
  p: RiepilogoPagamento;
  grande?: boolean;
  evidenzia?: boolean;
}) {
  if (p.stato === "PAGATO") {
    return (
      <Badge colore="verde" grande={grande}>
        Pagato
      </Badge>
    );
  }
  const manca = p.daPagare ? ` · mancano ${formattaEuro(p.daPagare)}` : "";
  if (p.stato === "ACCONTO") {
    return (
      <Badge colore={evidenzia ? "rosso" : "ambra"} grande={grande}>
        Acconto {formattaEuro(p.pagato)}
        {manca}
      </Badge>
    );
  }
  return (
    <Badge colore={evidenzia ? "rosso" : "grigio"} grande={grande}>
      {evidenzia ? "Da incassare" : "Non pagato"}
      {p.daPagare && ` ${formattaEuro(p.daPagare)}`}
    </Badge>
  );
}

// -----------------------------------------------------------------------------
// Scadenza e avanzamento
// -----------------------------------------------------------------------------

// Colore della scritta "in ritardo / oggi / tra N giorni", per tono (vedi urgenzaScadenza).
const toni = {
  ritardo: "bg-red-100 text-red-800",
  oggi: "bg-amber-100 text-amber-900",
  presto: "bg-sky-100 text-sky-800",
  tranquillo: "bg-slate-100 text-slate-700",
  nessuna: "bg-slate-100 text-slate-500",
};

/** Data di consegna con la scritta "in ritardo / oggi / tra N giorni". `aperto` = conta ancora. */
export function Scadenza({ data, aperto = true, grande }: { data: Date | null; aperto?: boolean; grande?: boolean }) {
  const u = urgenzaScadenza(data);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={cn("font-semibold", grande && "text-lg")}>{data ? formattaGiorno(data) : "Nessuna data"}</span>
      {aperto && data && (
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", toni[u.tono])}>{u.testo}</span>
      )}
    </span>
  );
}

/** Barra dei pezzi: blu = ritirati, verde = pronti, grigio = da fare. */
export function Avanzamento({
  pronti,
  consegnati,
  totale,
  grande,
}: {
  pronti: number;
  consegnati: number;
  totale: number;
  grande?: boolean;
}) {
  if (totale === 0) return null;
  const pPronti = Math.round((pronti / totale) * 100);
  const pConsegnati = Math.round((consegnati / totale) * 100);
  return (
    <div className="grid gap-1.5">
      {/* Due pezzi di barra uno dopo l'altro: prima i ritirati (blu), poi i pronti non ancora ritirati (verde). */}
      <div className={cn("flex w-full overflow-hidden rounded-full bg-slate-200", grande ? "h-3" : "h-2")}>
        <div className="bg-blue-500" style={{ width: `${pConsegnati}%` }} />
        <div className="bg-emerald-500" style={{ width: `${Math.max(pPronti - pConsegnati, 0)}%` }} />
      </div>
      <span className={cn("text-muted-foreground", grande ? "text-sm" : "text-xs")}>
        <strong className="text-foreground">{pronti}</strong> pronti su {totale}
        {consegnati > 0 && (
          <>
            {" "}
            · <strong className="text-foreground">{consegnati}</strong> già ritirati
          </>
        )}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Schede ordine (pagine Oggi, Ordini, Cliente)
// -----------------------------------------------------------------------------

// Colore della striscia a sinistra della scheda: dice a colpo d'occhio quanto è urgente.
// "before:" = Tailwind disegna la striscia con uno pseudo-elemento ::before.
const striscia = {
  ritardo: "before:bg-red-500",
  oggi: "before:bg-amber-400",
  presto: "before:bg-sky-400",
  tranquillo: "before:bg-slate-300",
  nessuna: "before:bg-slate-200",
};

// Stati in cui il cliente sta per ritirare (o ha ritirato): se non ha pagato va ricordato.
const PEZZI_DA_CONSEGNARE: string[] = ["PRONTO", "PARZIALMENTE_CONSEGNATO", "CONSEGNATO"];

/** Un ordine come "scheda" grande e cliccabile. */
export function OrdineCard({ o }: { o: OrdineInElenco }) {
  const aperto = isOrdineAperto(o.stato);
  const u = urgenzaScadenza(o.dataConsegna);
  return (
    <Link
      href={`/ordini/${o.id}`}
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-4 pl-6 shadow-[0_1px_3px_rgb(0_0_0/0.04)] transition hover:border-primary/40 hover:shadow-md",
        "before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        aperto ? striscia[u.tono] : "before:bg-slate-200",
      )}
    >
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-lg font-bold">{o.cliente.nome}</span>
          {o.urgente && aperto && <BadgeUrgente />}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Ordine {formattaNumeroOrdine(o)}</span>
          <BadgeStatoOrdine stato={o.stato} />
          {o.stato !== "ANNULLATO" && o.stato !== "VUOTO" && (
            <BadgePagamento p={o.pagamento} evidenzia={PEZZI_DA_CONSEGNARE.includes(o.stato)} />
          )}
        </div>
        <div className="max-w-xs">
          <Avanzamento {...o.pezzi} />
        </div>
      </div>
      {/* La data a destra si vede solo da tablet/computer (sm:block). */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="font-semibold">{o.dataConsegna ? formattaGiorno(o.dataConsegna) : "Senza data"}</div>
        {aperto && o.dataConsegna && (
          <div
            className={cn(
              "text-sm font-semibold",
              u.tono === "ritardo" ? "text-red-600" : u.tono === "oggi" ? "text-amber-600" : "text-muted-foreground",
            )}
          >
            {u.testo}
          </div>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}

/** Elenco di schede ordine, o un riquadro tratteggiato con "vuoto" se non ce ne sono. */
export function ElencoOrdini({ ordini, vuoto = "Nessun ordine." }: { ordini: OrdineInElenco[]; vuoto?: string }) {
  if (ordini.length === 0) {
    return <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{vuoto}</p>;
  }
  return (
    <div className="grid gap-3">
      {ordini.map((o) => (
        <OrdineCard key={o.id} o={o} />
      ))}
    </div>
  );
}
