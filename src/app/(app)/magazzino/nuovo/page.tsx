// =============================================================================
// /magazzino/nuovo — nuovo articolo (poi si aggiungono i pezzi dalla sua pagina)
// =============================================================================

import type { Metadata } from "next";
import { Card, TitoloPagina } from "@/comune/componenti";
import { categorieArticoli } from "@/magazzino/database";
import { ArticoloForm } from "@/magazzino/moduli";

export const metadata: Metadata = { title: "Nuovo articolo" };

export default async function NuovoArticoloPage() {
  const categorie = await categorieArticoli();
  return (
    <div className="mx-auto max-w-2xl">
      <TitoloPagina titolo="Nuovo articolo" sottotitolo="Dopo averlo creato, aggiungi i pezzi con “Arrivata merce”." />
      <Card className="p-5 sm:p-6">
        <ArticoloForm categorie={categorie} />
      </Card>
    </div>
  );
}
