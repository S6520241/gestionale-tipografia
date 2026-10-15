// =============================================================================
// /ordini/[id]/righe/nuova — aggiungi un prodotto all'ordine
// =============================================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TitoloPagina } from "@/comune/componenti";
import { db } from "@/comune/server";
import { articoliPerScelta } from "@/magazzino/database";
import { formattaNumeroOrdine } from "@/ordini/calcoli";
import { RigaForm } from "@/ordini/modulo-prodotto";

export const metadata: Metadata = { title: "Nuovo prodotto" };

export default async function NuovaRigaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ordine, articoli] = await Promise.all([
    db.ordine.findUnique({ where: { id }, include: { cliente: { select: { nome: true } } } }),
    articoliPerScelta(),
  ]);
  if (!ordine) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <TitoloPagina
        titolo="Aggiungi un prodotto"
        sottotitolo={`Ordine ${formattaNumeroOrdine(ordine)} di ${ordine.cliente.nome}`}
      />
      <RigaForm ordineId={id} articoli={articoli} />
    </div>
  );
}
