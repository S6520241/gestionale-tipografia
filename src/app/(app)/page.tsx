// =============================================================================
// / — pagina iniziale "Oggi"
// =============================================================================
// Risponde alla domanda principale del negozio, "cosa devo fare e consegnare
// adesso?": quattro riquadri con i numeri e, sotto, gli ordini aperti divisi per scadenza.

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ClipboardList, PackageCheck } from "lucide-react";
import { auth } from "@/auth";
import { cn } from "@/comune/componenti";
import { giorniAllaConsegna, isOrdineAperto } from "@/ordini/calcoli";
import { ElencoOrdini } from "@/ordini/componenti";
import { elencoOrdini, type OrdineInElenco } from "@/ordini/database";

export const metadata: Metadata = { title: "Oggi" };

/** Giorni alla consegna di un ordine (negativo = in ritardo, null = senza data). */
const giorni = (o: OrdineInElenco) => giorniAllaConsegna(o.dataConsegna);

/** Riquadro colorato con un numero grande: si clicca per vedere la lista. */
function Riquadro({
  href,
  numero,
  testo,
  icona: Icona,
  colore,
}: {
  href: string;
  numero: number;
  testo: string;
  icona: typeof AlertTriangle;
  colore: "rosso" | "ambra" | "verde" | "viola";
}) {
  const stili = {
    rosso: "from-red-500 to-rose-500 shadow-red-500/25",
    ambra: "from-amber-400 to-orange-500 shadow-amber-500/25",
    verde: "from-emerald-500 to-teal-500 shadow-emerald-500/25",
    viola: "from-violet-500 to-indigo-500 shadow-violet-500/25",
  };
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col justify-between gap-3 rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg transition hover:scale-[1.02] sm:p-5",
        stili[colore],
        numero === 0 && "opacity-60 saturate-50",
      )}
    >
      <Icona className="size-7 opacity-90" />
      <div>
        <div className="text-4xl font-black leading-none">{numero}</div>
        <div className="mt-1 text-sm font-semibold opacity-95 sm:text-base">{testo}</div>
      </div>
    </Link>
  );
}

/** Un gruppo di ordini con il titolo e un pallino colorato. */
function Sezione({ titolo, colore, children }: { titolo: string; colore: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className={cn("size-3 rounded-full", colore)} /> {titolo}
      </h2>
      {children}
    </section>
  );
}

export default async function OggiPage() {
  const [session, tutti] = await Promise.all([auth(), elencoOrdini()]);
  const aperti = tutti.filter((o) => isOrdineAperto(o.stato));

  // I gruppi, per giorni alla consegna. "?? 0": un ordine senza data non è in ritardo.

  const inRitardo = aperti.filter((o) => (giorni(o) ?? 0) < 0);
  const oggiDomani = aperti.filter((o) => giorni(o) === 0 || giorni(o) === 1);
  const pronti = aperti.filter((o) => o.stato === "PRONTO");
  const prossimi = aperti.filter((o) => {
    const g = giorni(o);
    return g !== null && g >= 2 && g <= 7;
  });
  const dopo = aperti.filter((o) => {
    const g = giorni(o);
    return g === null || g > 7;
  });
  // Dentro ogni gruppo: prima gli urgenti (l'ordine per data arriva già da elencoOrdini).
  for (const l of [inRitardo, oggiDomani, prossimi, dopo]) l.sort((a, b) => Number(b.urgente) - Number(a.urgente));

  const oggi = new Date().toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const nome = session?.user?.name?.split(" ")[0]; // solo il nome, senza cognome

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-base font-semibold text-primary first-letter:uppercase">{oggi}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Ciao{nome ? `, ${nome}` : ""}!</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Riquadro
          href="/ordini?filtro=ritardo"
          numero={inRitardo.length}
          testo="In ritardo"
          icona={AlertTriangle}
          colore="rosso"
        />
        <Riquadro
          href="/ordini?filtro=oggi"
          numero={oggiDomani.length}
          testo="Per oggi e domani"
          icona={CalendarClock}
          colore="ambra"
        />
        <Riquadro
          href="/ordini?filtro=pronti"
          numero={pronti.length}
          testo="Pronti da ritirare"
          icona={PackageCheck}
          colore="verde"
        />
        <Riquadro href="/ordini" numero={aperti.length} testo="Ordini aperti" icona={ClipboardList} colore="viola" />
      </div>

      {aperti.length === 0 && (
        <p className="rounded-2xl border border-dashed p-10 text-center text-lg text-muted-foreground">
          Nessun ordine aperto. Per iniziarne uno premi &quot;Nuovo ordine&quot;.
        </p>
      )}

      {inRitardo.length + oggiDomani.length > 0 && (
        <Sezione titolo="Da fare subito" colore="bg-red-500">
          <ElencoOrdini ordini={[...inRitardo, ...oggiDomani]} />
        </Sezione>
      )}

      {pronti.length > 0 && (
        <Sezione titolo="Pronti: avvisa il cliente" colore="bg-emerald-500">
          <ElencoOrdini ordini={pronti} />
        </Sezione>
      )}

      {prossimi.length > 0 && (
        <Sezione titolo="Nei prossimi 7 giorni" colore="bg-sky-500">
          <ElencoOrdini ordini={prossimi} />
        </Sezione>
      )}

      {dopo.length > 0 && (
        <Sezione titolo="Più avanti o senza data" colore="bg-slate-400">
          <ElencoOrdini ordini={dopo} />
        </Sezione>
      )}
    </div>
  );
}
