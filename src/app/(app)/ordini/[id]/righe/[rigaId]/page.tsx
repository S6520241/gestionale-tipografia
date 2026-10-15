// =============================================================================
// /ordini/[id]/righe/[rigaId] — modifica (o elimina) un prodotto dell'ordine
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TitoloPagina } from "@/comune/componenti";
import { BottoneInvio, FormAzione } from "@/comune/moduli";
import { db } from "@/comune/server";
import { articoliPerScelta } from "@/magazzino/database";
import { eliminaRiga } from "@/ordini/azioni";
import { formattaNumeroOrdine } from "@/ordini/calcoli";
import { type ApplicazioneForm, RigaForm } from "@/ordini/modulo-prodotto";
import { parametriRicamoSchema, parametriStampaSchema } from "@/ordini/regole";

export const metadata: Metadata = { title: "Modifica prodotto" };

export default async function ModificaRigaPage({ params }: { params: Promise<{ id: string; rigaId: string }> }) {
  const { id, rigaId } = await params;
  const articoli = await articoliPerScelta();
  const riga = await db.rigaOrdine.findUnique({
    where: { id: rigaId },
    include: { varianti: { orderBy: { id: "asc" } }, applicazioni: { orderBy: { id: "asc" } }, ordine: true },
  });
  // Il prodotto deve essere di QUESTO ordine (l'indirizzo si può scrivere a mano).
  if (!riga || riga.ordineId !== id) notFound();

  // Dal database (Decimal, Json) ai valori del modulo (solo testo).
  const applicazioni: ApplicazioneForm[] = riga.applicazioni.map((a) => {
    const stampa = parametriStampaSchema.safeParse(a.parametri);
    const ricamo = parametriRicamoSchema.safeParse(a.parametri);
    return {
      tecnica: a.tecnica,
      posizione: a.posizione ?? "",
      colori:
        a.tecnica === "STAMPA" && stampa.success
          ? stampa.data.colori.join(", ")
          : a.tecnica === "RICAMO" && ricamo.success
            ? ricamo.data.coloriFili.join(", ")
            : "",
      numeroPunti: a.tecnica === "RICAMO" && ricamo.success ? String(ricamo.data.numeroPunti ?? "") : "",
      note: a.note ?? "",
    };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <TitoloPagina
        titolo="Modifica prodotto"
        sottotitolo={`Ordine ${formattaNumeroOrdine(riga.ordine)}`}
        azioni={
          <FormAzione
            action={eliminaRiga.bind(null, id, rigaId)}
            conferma="Eliminare definitivamente questo prodotto? (Solo se inserito per errore)"
          >
            <BottoneInvio variant="outline" className="text-destructive">
              Elimina prodotto
            </BottoneInvio>
          </FormAzione>
        }
      />
      <RigaForm
        ordineId={id}
        rigaId={rigaId}
        articoli={articoli}
        iniziale={{
          articoloId: riga.articoloId,
          descrizione: riga.descrizione,
          tipo: riga.tipo,
          prezzoUnitario: riga.prezzoUnitario?.toString().replace(".", ",") ?? "", // 8.5 -> "8,5"
          note: riga.note ?? "",
          varianti: riga.varianti.map((x) => ({ colore: x.colore, taglia: x.taglia, quantita: String(x.quantita) })),
          applicazioni,
        }}
      />
    </div>
  );
}
