// =============================================================================
// /magazzino/[id] — un articolo: pezzi per colore e taglia, movimenti, modifica
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, cn, TitoloPagina } from "@/comune/componenti";
import { BottoneInvio, FormAzione } from "@/comune/moduli";
import { formattaDataOra } from "@/comune/regole";
import { archiviaArticolo } from "@/magazzino/azioni";
import { GrigliaGiacenza } from "@/magazzino/componenti";
import { categorieArticoli, leggiArticolo } from "@/magazzino/database";
import { ArticoloForm, BottoniMagazzino } from "@/magazzino/moduli";
import { CAUSALI } from "@/magazzino/regole";
import { formattaNumeroOrdine } from "@/ordini/calcoli";
import { ammetteTaglie } from "@/ordini/regole";

export const metadata: Metadata = { title: "Articolo" };

export default async function ArticoloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, categorie] = await Promise.all([leggiArticolo(id), categorieArticoli()]);
  if (!a) notFound();
  // Le taglie si chiedono per l'abbigliamento, o se l'articolo ne ha già.
  const conTaglie = ammetteTaglie(a.tipo) || a.varianti.some((v) => v.taglia);

  return (
    <div className="grid gap-5">
      <Link href="/magazzino" className="flex w-fit items-center gap-1 font-semibold text-muted-foreground">
        <ArrowLeft className="size-4" /> Magazzino
      </Link>
      <TitoloPagina
        className="mb-0"
        titolo={a.nome}
        sottotitolo={
          <>
            {a.categoria ?? "Senza categoria"} · <strong className="text-foreground">{a.totale} pezzi</strong> in tutto
            {a.archiviato && " · archiviato"}
          </>
        }
      />

      <BottoniMagazzino articoloId={a.id} varianti={a.varianti} conTaglie={conTaglie} />

      <Card>
        <CardHeader>
          <CardTitle>Quanti ce ne sono</CardTitle>
          <p className="text-sm text-muted-foreground">
            In rosso: sotto zero (sono stati usati più pezzi di quelli segnati, conviene contarli e correggere).
          </p>
        </CardHeader>
        <CardContent>
          <GrigliaGiacenza varianti={a.varianti} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ultimi movimenti</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {a.movimenti.length === 0 && <p className="text-muted-foreground">Nessun movimento.</p>}
          {/* Un movimento: +N verdi (entrati) o -N rossi (usciti), perché, quando, chi e per quale ordine. */}
          {a.movimenti.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 last:border-0">
              <span
                className={cn(
                  "w-14 text-right text-lg font-bold tabular-nums",
                  m.quantita > 0 ? "text-emerald-700" : "text-red-700",
                )}
              >
                {m.quantita > 0 ? `+${m.quantita}` : m.quantita}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {CAUSALI[m.causale]} · {[m.variante.colore, m.variante.taglia].filter(Boolean).join(" ") || "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formattaDataOra(m.data)}
                  {m.utente?.name && ` · ${m.utente.name}`}
                  {m.note && ` · ${m.note}`}
                  {m.riga && (
                    <>
                      {" · "}
                      <Link href={`/ordini/${m.riga.ordine.id}`} className="font-semibold text-primary hover:underline">
                        ordine {formattaNumeroOrdine(m.riga.ordine)} – {m.riga.ordine.cliente.nome}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <details className="group rounded-2xl border bg-card">
        <summary className="flex cursor-pointer items-center gap-2 p-5 font-semibold">
          <Pencil className="size-4" /> Modifica nome o categoria
        </summary>
        <div className="grid gap-5 px-5 pb-5">
          <ArticoloForm articolo={a} categorie={categorie} />
          <FormAzione
            action={archiviaArticolo.bind(null, a.id, !a.archiviato)}
            conferma={a.archiviato ? undefined : "Archiviare l'articolo? Non comparirà più nel magazzino."}
          >
            <BottoneInvio variant="outline" className="w-fit">
              {a.archiviato ? "Riporta nel magazzino" : "Archivia articolo (non lo vendiamo più)"}
            </BottoneInvio>
          </FormAzione>
        </div>
      </details>
    </div>
  );
}
