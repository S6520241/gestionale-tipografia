"use client";

// =============================================================================
// ordini/moduli.tsx — moduli dell'ordine (girano nel browser)
// =============================================================================
//   OrdineForm        cliente, data di consegna, urgente, note
//   BottoniPagamento  "Ha lasciato un acconto" / "Ha pagato tutto"
//   PezziPronti       il contatore − / + dei pezzi pronti di un prodotto
// Il modulo del prodotto, più lungo, è in ordini/modulo-prodotto.tsx.

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, HandCoins, Minus, Plus } from "lucide-react";
import { Button, Campo, Input, PiedeModulo, Select, Textarea } from "@/comune/componenti";
import { BottoneInvio, FormAzione } from "@/comune/moduli";
import type { Esito } from "@/comune/server";
import { registraPagamento, salvaOrdine } from "./azioni";

// -----------------------------------------------------------------------------
// Ordine
// -----------------------------------------------------------------------------

type DatiOrdine = {
  id: string;
  clienteId: string;
  dataConsegna: string | null; // "AAAA-MM-GG"
  urgente: boolean;
  note: string | null;
};

/**
 * Nuovo ordine (senza "ordine") o modifica. "clienteIniziale" = cliente già scelto,
 * quando si arriva dalla pagina di un cliente o dopo averne creato uno nuovo.
 */
export function OrdineForm({
  ordine,
  clienti,
  clienteIniziale,
}: {
  ordine?: DatiOrdine;
  clienti: { id: string; nome: string }[];
  clienteIniziale?: string;
}) {
  const [esito, action, pending] = useActionState<Esito, FormData>(salvaOrdine.bind(null, ordine?.id ?? null), {});
  const e = esito.errori ?? {};
  const v = esito.valori; // valori inviati, se l'ultimo invio non è andato a buon fine

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Campo label="Per quale cliente? *" htmlFor="clienteId" errore={e.clienteId} className="sm:col-span-2">
        <div className="flex gap-2">
          <Select
            id="clienteId"
            name="clienteId"
            defaultValue={v?.clienteId ?? ordine?.clienteId ?? clienteIniziale ?? ""}
            required
          >
            <option value="" disabled>
              Scegli un cliente...
            </option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          {/* "ritorno=ordine": dopo aver creato il cliente si torna qui, con il cliente già scelto. */}
          {!ordine && (
            <Link
              href="/clienti/nuovo?ritorno=ordine"
              className="self-center font-semibold whitespace-nowrap text-primary"
            >
              + Nuovo cliente
            </Link>
          )}
        </div>
      </Campo>
      <Campo
        label="Quando va consegnato?"
        htmlFor="dataConsegna"
        errore={e.dataConsegna}
        aiuto="Lascia vuoto se non c'è una data"
      >
        <Input
          id="dataConsegna"
          name="dataConsegna"
          type="date"
          defaultValue={v?.dataConsegna ?? ordine?.dataConsegna ?? ""}
        />
      </Campo>
      {/* has-checked: la casella diventa rossa quando è spuntata (solo CSS). */}
      <label className="flex h-12 cursor-pointer items-center gap-3 self-end rounded-xl border-2 border-input px-4 font-semibold has-checked:border-red-400 has-checked:bg-red-50 has-checked:text-red-700">
        <input
          type="checkbox"
          name="urgente"
          defaultChecked={v ? v.urgente === "on" : ordine?.urgente}
          className="size-5 accent-red-600"
        />
        🔥 È urgente
      </label>
      <Campo label="Note" htmlFor="note" errore={e.note} className="sm:col-span-2">
        <Textarea
          id="note"
          name="note"
          defaultValue={v?.note ?? ordine?.note ?? ""}
          placeholder="Es. ritira il figlio, chiamare prima"
        />
      </Campo>
      <PiedeModulo pending={pending} testo={ordine ? "Salva" : "Crea ordine e aggiungi prodotti"} esito={esito} />
    </form>
  );
}

// -----------------------------------------------------------------------------
// Pagamenti
// -----------------------------------------------------------------------------

/**
 * I due tasti grandi "Ha lasciato un acconto" e "Ha pagato tutto".
 * Toccandone uno si apre un piccolo modulo con l'importo; dopo il salvataggio si
 * richiude perché la pagina ricrea questo componente (vedi key nella pagina dell'ordine).
 * "daPagare" = quanto manca, già scritto nel campo per "Ha pagato tutto".
 */
export function BottoniPagamento({ ordineId, daPagare }: { ordineId: string; daPagare: string | null }) {
  const [aperto, setAperto] = useState<"ACCONTO" | "SALDO" | null>(null);
  const [esito, action, pending] = useActionState<Esito, FormData>(registraPagamento.bind(null, ordineId), {});
  const e = esito.errori ?? {};

  if (!aperto) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="xl"
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
          onClick={() => setAperto("ACCONTO")}
        >
          <HandCoins /> Ha lasciato un acconto
        </Button>
        <Button size="xl" variant="success" onClick={() => setAperto("SALDO")}>
          <Check /> Ha pagato tutto
        </Button>
      </div>
    );
  }

  const acconto = aperto === "ACCONTO";
  return (
    <form action={action} className="grid gap-4 rounded-xl border-2 bg-card p-4">
      {/* Campo nascosto: dice alla server action se è un acconto o un saldo. */}
      <input type="hidden" name="tipo" value={aperto} />
      <p className="text-lg font-bold">{acconto ? "Quanto ha lasciato di acconto?" : "Ha pagato tutto"}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label={acconto ? "Acconto (€) *" : "Quanto ha dato (€)"}
          htmlFor="importo"
          errore={e.importo}
          aiuto={
            acconto
              ? undefined
              : daPagare
                ? "Già scritto quello che mancava: cambialo se ha dato meno (sconto)."
                : "Facoltativo: l'ordine non ha prezzi."
          }
        >
          <Input
            id="importo"
            name="importo"
            inputMode="decimal"
            autoFocus
            placeholder="Es. 50"
            defaultValue={esito.valori?.importo ?? (acconto ? "" : (daPagare ?? ""))}
            className="text-lg font-bold"
          />
        </Campo>
        <Campo label="Note" htmlFor="notePagamento">
          <Input
            id="notePagamento"
            name="note"
            placeholder="Es. contanti, bonifico"
            defaultValue={esito.valori?.note ?? ""}
          />
        </Campo>
      </div>
      {esito.errore && <p className="font-medium text-destructive">{esito.errore}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" variant={acconto ? "default" : "success"} disabled={pending}>
          {pending ? "Salvataggio..." : acconto ? "Salva acconto" : "Segna come pagato"}
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={() => setAperto(null)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Pezzi pronti
// -----------------------------------------------------------------------------

/** Contatore dei pezzi pronti con i bottoni − e +: più facile che scrivere un numero. */
export function PezziPronti({
  action,
  pronti,
  totale,
  minimo,
}: {
  action: (prev: Esito, fd: FormData) => Promise<Esito>;
  pronti: number;
  totale: number;
  minimo: number; // i pezzi già ritirati: sotto non si può scendere
}) {
  const [valore, setValore] = useState(pronti);
  // Il numero resta sempre tra "minimo" e "totale".
  const cambia = (n: number) => setValore(Math.min(totale, Math.max(minimo, n)));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FormAzione action={action} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border-2 border-input bg-card">
          <button
            type="button"
            aria-label="Uno in meno"
            onClick={() => cambia(valore - 1)}
            className="flex size-11 items-center justify-center rounded-l-xl hover:bg-accent"
          >
            <Minus className="size-5" />
          </button>
          <input
            name="quantitaPronta"
            inputMode="numeric"
            value={valore}
            // replace(/\D/g, ""): tiene solo le cifre di quello che si scrive.
            onChange={(e) => cambia(Number(e.target.value.replace(/\D/g, "")) || 0)}
            className="h-11 w-16 border-x-2 border-input text-center text-lg font-bold outline-none"
          />
          <button
            type="button"
            aria-label="Uno in più"
            onClick={() => cambia(valore + 1)}
            className="flex size-11 items-center justify-center rounded-r-xl hover:bg-accent"
          >
            <Plus className="size-5" />
          </button>
        </div>
        <span className="text-base text-muted-foreground">su {totale}</span>
        {/* "Salva" compare solo se il numero è stato cambiato. */}
        {valore !== pronti && <BottoneInvio>Salva</BottoneInvio>}
      </FormAzione>
      {pronti < totale && (
        <FormAzione action={action}>
          <input type="hidden" name="quantitaPronta" value={totale} />
          <BottoneInvio variant="success" onClick={() => setValore(totale)}>
            <Check /> Tutto pronto
          </BottoneInvio>
        </FormAzione>
      )}
    </div>
  );
}
