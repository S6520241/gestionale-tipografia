// =============================================================================
// /clienti/[id] — scheda di un cliente: contatti, i suoi ordini, modifica
// =============================================================================
// [id] nel nome della cartella = parte variabile dell'indirizzo (/clienti/abc123).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, Mail, Phone, Plus, UserCog } from "lucide-react";
import { archiviaCliente } from "@/clienti/azioni";
import { leggiCliente } from "@/clienti/database";
import { ClienteForm } from "@/clienti/moduli";
import { Avatar, Badge, buttonVariants, Card } from "@/comune/componenti";
import { BottoneInvio, FormAzione } from "@/comune/moduli";
import { ElencoOrdini } from "@/ordini/componenti";
import { elencoOrdini } from "@/ordini/database";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await leggiCliente(id);
  if (!cliente) notFound(); // mostra app/(app)/not-found.tsx
  const ordini = await elencoOrdini({ clienteId: id });

  return (
    <div className="grid gap-6">
      <Link
        href="/clienti"
        className="flex w-fit items-center gap-2 font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-5" /> Tutti i clienti
      </Link>

      <Card className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <Avatar nome={cliente.nome} className="size-16 text-2xl" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold sm:text-3xl">
            {cliente.nome}
            {cliente.archiviato && <Badge colore="rosso">Archiviato</Badge>}
          </h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {cliente.telefono && (
              // tel: e mailto: aprono il telefono o la posta (dal telefono basta un tocco per chiamare).
              <a
                href={`tel:${cliente.telefono.replace(/\s/g, "")}`}
                className="flex items-center gap-2 font-semibold text-primary"
              >
                <Phone className="size-4" /> {cliente.telefono}
              </a>
            )}
            {cliente.email && (
              <a href={`mailto:${cliente.email}`} className="flex items-center gap-2 font-semibold text-primary">
                <Mail className="size-4" /> {cliente.email}
              </a>
            )}
          </div>
          {cliente.note && <p className="text-muted-foreground">📝 {cliente.note}</p>}
        </div>
        {!cliente.archiviato && (
          <Link href={`/ordini/nuovo?clienteId=${cliente.id}`} className={buttonVariants({ size: "lg" })}>
            <Plus /> Nuovo ordine
          </Link>
        )}
      </Card>

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">Ordini di questo cliente ({ordini.length})</h2>
        <ElencoOrdini ordini={ordini} vuoto="Questo cliente non ha ancora ordini." />
      </section>

      {/* Modifica e archivia: chiusi in un <details>, perché si usano di rado. */}
      <details className="group rounded-2xl border bg-card">
        <summary className="flex cursor-pointer items-center justify-between p-5 font-semibold sm:px-6">
          <span className="flex items-center gap-2">
            <UserCog className="size-5 text-muted-foreground" /> Modifica i dati del cliente
          </span>
          <ChevronDown className="size-5 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-6 border-t p-5 sm:p-6">
          <ClienteForm cliente={cliente} />
          <div className="border-t pt-5">
            <FormAzione
              action={archiviaCliente.bind(null, cliente.id, !cliente.archiviato)}
              conferma={
                cliente.archiviato
                  ? undefined
                  : "Archiviare il cliente? Sparirà dagli elenchi, ma i suoi ordini restano."
              }
            >
              <BottoneInvio variant="outline">
                {cliente.archiviato ? "Ripristina il cliente" : "Archivia il cliente"}
              </BottoneInvio>
            </FormAzione>
          </div>
        </div>
      </details>
    </div>
  );
}
