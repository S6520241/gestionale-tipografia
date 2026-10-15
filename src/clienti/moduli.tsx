"use client";

// =============================================================================
// clienti/moduli.tsx — il modulo del cliente (nuovo o modifica)
// =============================================================================

import { useActionState } from "react";
import type { Cliente } from "@prisma/client";
import { Campo, Input, PiedeModulo, Textarea } from "@/comune/componenti";
import type { Esito } from "@/comune/server";
import { salvaCliente } from "./azioni";

/**
 * Modulo del cliente. Senza "cliente" ne crea uno nuovo.
 * "ritorno" = "ordine" se si arriva dal modulo Nuovo ordine (dopo si torna lì).
 */
export function ClienteForm({ cliente, ritorno }: { cliente?: Cliente; ritorno?: string }) {
  // bind: "fissa" il primo argomento della action (l'id, o null per un nuovo cliente).
  const [esito, action, pending] = useActionState<Esito, FormData>(salvaCliente.bind(null, cliente?.id ?? null), {});
  const e = esito.errori ?? {};
  // Dopo un errore si rimostra quanto scritto, altrimenti i dati salvati.
  const val = (campo: keyof Cliente) => esito.valori?.[campo] ?? (cliente?.[campo] as string | null) ?? "";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {ritorno && <input type="hidden" name="ritorno" value={ritorno} />}
      <Campo label="Nome / ragione sociale *" htmlFor="nome" errore={e.nome} className="sm:col-span-2">
        <Input id="nome" name="nome" defaultValue={val("nome")} required />
      </Campo>
      <Campo label="Telefono" htmlFor="telefono" errore={e.telefono}>
        <Input id="telefono" name="telefono" type="tel" defaultValue={val("telefono")} />
      </Campo>
      <Campo label="Email" htmlFor="email" errore={e.email}>
        <Input id="email" name="email" type="email" defaultValue={val("email")} />
      </Campo>
      <Campo label="Partita IVA" htmlFor="partitaIva" errore={e.partitaIva}>
        <Input id="partitaIva" name="partitaIva" inputMode="numeric" defaultValue={val("partitaIva")} />
      </Campo>
      <Campo label="Codice fiscale" htmlFor="codiceFiscale" errore={e.codiceFiscale}>
        <Input id="codiceFiscale" name="codiceFiscale" defaultValue={val("codiceFiscale")} />
      </Campo>
      <Campo label="Note" htmlFor="note" errore={e.note} className="sm:col-span-2">
        <Textarea id="note" name="note" defaultValue={val("note")} />
      </Campo>
      <PiedeModulo pending={pending} testo={cliente ? "Salva modifiche" : "Crea cliente"} esito={esito} />
    </form>
  );
}
