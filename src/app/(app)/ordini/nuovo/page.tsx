// =============================================================================
// /ordini/nuovo — nuovo ordine (dopo il salvataggio si aggiunge il primo prodotto)
// =============================================================================
// ?clienteId=...: cliente già scelto (dalla pagina del cliente o dopo averne creato uno).

import type { Metadata } from "next";
import { clientiPerSelect } from "@/clienti/database";
import { Card, TitoloPagina } from "@/comune/componenti";
import { OrdineForm } from "@/ordini/moduli";

export const metadata: Metadata = { title: "Nuovo ordine" };

export default async function NuovoOrdinePage({ searchParams }: { searchParams: Promise<{ clienteId?: string }> }) {
  const { clienteId } = await searchParams;
  const clienti = await clientiPerSelect();
  return (
    <div className="mx-auto max-w-2xl">
      <TitoloPagina
        titolo="Nuovo ordine"
        sottotitolo="Scegli il cliente e la data. I prodotti li aggiungi subito dopo."
      />
      <Card className="p-5 sm:p-6">
        <OrdineForm clienti={clienti} clienteIniziale={clienteId} />
      </Card>
    </div>
  );
}
