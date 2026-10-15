// =============================================================================
// /clienti/nuovo — nuovo cliente
// =============================================================================
// ?ritorno=ordine: si arriva dal modulo "Nuovo ordine"; dopo il salvataggio si
// torna lì con il cliente già scelto (lo fa salvaCliente in clienti/azioni.ts).

import type { Metadata } from "next";
import { ClienteForm } from "@/clienti/moduli";
import { Card, TitoloPagina } from "@/comune/componenti";

export const metadata: Metadata = { title: "Nuovo cliente" };

export default async function NuovoClientePage({ searchParams }: { searchParams: Promise<{ ritorno?: string }> }) {
  const { ritorno } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <TitoloPagina titolo="Nuovo cliente" sottotitolo="Basta il nome: il resto si può completare dopo." />
      <Card className="p-5 sm:p-6">
        <ClienteForm ritorno={ritorno} />
      </Card>
    </div>
  );
}
