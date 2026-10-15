"use client";

// =============================================================================
// magazzino/moduli.tsx — moduli del magazzino (girano nel browser)
// =============================================================================
//   ArticoloForm      nuovo articolo, o modifica di nome/categoria/note
//   BottoniMagazzino  i due bottoni grandi "Arrivata merce" e "Correggi quantità"
//                     della pagina dell'articolo, che aprono MovimentoForm
//   SceltaArticolo    la ricerca di un articolo nel modulo del prodotto di un ordine

import { useActionState, useState } from "react";
import type { Articolo } from "@prisma/client";
import { ClipboardCheck, Package, Search, Truck, X } from "lucide-react";
import { Button, Campo, Card, Input, PiedeModulo, Select, Textarea } from "@/comune/componenti";
import type { Esito } from "@/comune/server";
import { registraMovimento, salvaArticolo } from "./azioni";
import type { ArticoloPerScelta } from "./database";
import { normalizzaTesto, ordinaTaglie, paroleRicerca } from "./regole";

// -----------------------------------------------------------------------------
// Articolo
// -----------------------------------------------------------------------------

/** Modulo dell'articolo. "categorie" = quelle già usate, suggerite mentre si scrive. */
export function ArticoloForm({ articolo, categorie }: { articolo?: Articolo; categorie: string[] }) {
  const [esito, action, pending] = useActionState<Esito, FormData>(salvaArticolo.bind(null, articolo?.id ?? null), {});
  const e = esito.errori ?? {};
  // Dopo un errore si rimostra quanto scritto, altrimenti i dati salvati.
  const val = (campo: "nome" | "categoria" | "note") =>
    esito.valori?.[campo] ?? (articolo?.[campo] as string | null) ?? "";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Campo label="Nome dell'articolo *" htmlFor="nome" errore={e.nome} className="sm:col-span-2">
        <Input id="nome" name="nome" defaultValue={val("nome")} placeholder="es. T-shirt cotone girocollo" required />
      </Campo>
      <Campo
        label="Categoria"
        htmlFor="categoria"
        errore={e.categoria}
        aiuto="Es. T-shirt e polo, Felpe e pile, Gadget. Scegline una esistente o scrivine una nuova."
        className="sm:col-span-2"
      >
        {/* list="categorie" collega il campo al <datalist>: il browser suggerisce le categorie esistenti. */}
        <Input id="categoria" name="categoria" list="categorie" defaultValue={val("categoria")} />
        <datalist id="categorie">
          {categorie.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Campo>
      <Campo label="Note" htmlFor="note" errore={e.note} className="sm:col-span-2">
        <Textarea id="note" name="note" defaultValue={val("note")} />
      </Campo>
      <PiedeModulo pending={pending} testo={articolo ? "Salva modifiche" : "Crea articolo"} esito={esito} />
    </form>
  );
}

// -----------------------------------------------------------------------------
// Arrivata merce / Correggi quantità
// -----------------------------------------------------------------------------

type Variante = { colore: string; taglia: string; giacenza: number };

/** I due bottoni grandi della pagina articolo: ognuno apre il modulo giusto al posto dei bottoni. */
export function BottoniMagazzino(props: { articoloId: string; varianti: Variante[]; conTaglie: boolean }) {
  const [aperto, setAperto] = useState<"ARRIVO" | "CORREZIONE" | null>(null); // quale modulo è aperto
  const [fatto, setFatto] = useState<string | null>(null); // messaggio verde dopo il salvataggio

  if (aperto)
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-bold">{aperto === "ARRIVO" ? "Arrivata merce" : "Correggi quantità"}</h2>
        <MovimentoForm
          {...props}
          key={aperto} // cambiando modulo, React ne crea uno nuovo (campi vuoti)
          tipo={aperto}
          onFatto={() => {
            setFatto(aperto === "ARRIVO" ? "✓ Pezzi aggiunti" : "✓ Quantità aggiornata");
            setAperto(null);
          }}
        />
      </Card>
    );

  return (
    <div className="grid gap-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-16 bg-emerald-600 text-lg hover:bg-emerald-700"
          onClick={() => {
            setFatto(null);
            setAperto("ARRIVO");
          }}
        >
          <Truck /> Arrivata merce
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-16 text-lg"
          onClick={() => {
            setFatto(null);
            setAperto("CORREZIONE");
          }}
        >
          <ClipboardCheck /> Correggi quantità
        </Button>
      </div>
      {fatto && (
        <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">{fatto}</span>
      )}
    </div>
  );
}

/**
 * "Arrivata merce" e "Correggi quantità": stesso modulo, due significati.
 *  - arrivo: si AGGIUNGONO pezzi a quelli che ci sono;
 *  - correzione: si scrive quanti pezzi ci sono DAVVERO (dopo averli contati).
 * Colore e taglia si scelgono da un menu; "+ Nuovo colore…" fa comparire un campo per scriverlo.
 */
function MovimentoForm({
  articoloId,
  tipo,
  varianti,
  conTaglie,
  onFatto,
}: {
  articoloId: string;
  tipo: "ARRIVO" | "CORREZIONE";
  varianti: Variante[];
  conTaglie: boolean;
  onFatto: () => void; // chiamata dopo il salvataggio (o con "Chiudi"): torna ai due bottoni
}) {
  const [esito, action, pending] = useActionState<Esito, FormData>(async (prev, fd) => {
    const r = await registraMovimento(articoloId, tipo, prev, fd);
    if (r.ok) onFatto();
    return r;
  }, {});
  const colori = [...new Set(varianti.map((v) => v.colore))].sort((a, b) => a.localeCompare(b, "it"));
  const taglie = ordinaTaglie([...new Set(varianti.map((v) => v.taglia))]);
  // Colore e taglia scelti: servono per mostrare "Ora ne risultano N".
  const [colore, setColore] = useState(esito.valori?.colore ?? colori[0] ?? "__nuovo");
  const [taglia, setTaglia] = useState(esito.valori?.taglia ?? taglie[0] ?? "");
  const attuale = varianti.find((v) => v.colore === colore && v.taglia === taglia)?.giacenza;
  const e = esito.errori ?? {};

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Campo label="Colore" htmlFor="colore" errore={e.colore}>
        <Select id="colore" name="colore" value={colore} onChange={(ev) => setColore(ev.target.value)}>
          {colori.map((c) => (
            <option key={c} value={c}>
              {c || "(senza colore)"}
            </option>
          ))}
          <option value="__nuovo">+ Nuovo colore…</option>
        </Select>
        {colore === "__nuovo" && <Input name="coloreNuovo" placeholder="Scrivi il colore" autoFocus required />}
      </Campo>
      {conTaglie ? (
        <Campo label="Taglia" htmlFor="taglia" errore={e.taglia}>
          <Select id="taglia" name="taglia" value={taglia} onChange={(ev) => setTaglia(ev.target.value)}>
            {taglie.map((t) => (
              <option key={t} value={t}>
                {t || "(senza taglia)"}
              </option>
            ))}
            <option value="__nuovo">+ Nuova taglia…</option>
          </Select>
          {taglia === "__nuovo" && <Input name="tagliaNuova" placeholder="es. XL" required />}
        </Campo>
      ) : (
        // Articolo senza taglie: si manda comunque il campo, vuoto.
        <input type="hidden" name="taglia" value="" />
      )}
      <Campo
        label={tipo === "ARRIVO" ? "Quanti pezzi sono arrivati?" : "Quanti pezzi ci sono adesso? (contati)"}
        htmlFor="quantita"
        errore={e.quantita}
        aiuto={attuale !== undefined ? `Ora ne risultano ${attuale}.` : undefined}
      >
        <Input
          id="quantita"
          name="quantita"
          type="number"
          inputMode="numeric"
          min={tipo === "ARRIVO" ? 1 : 0}
          defaultValue={esito.valori?.quantita}
          className="text-lg font-bold"
          required
        />
      </Campo>
      <Campo label="Note" htmlFor="note" errore={e.note}>
        <Input id="note" name="note" placeholder={tipo === "ARRIVO" ? "es. fornitore, bolla n." : "es. inventario"} />
      </Campo>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvataggio..." : tipo === "ARRIVO" ? "Aggiungi i pezzi" : "Salva la quantità giusta"}
        </Button>
        <Button type="button" variant="ghost" onClick={onFatto}>
          Chiudi
        </Button>
        {esito.errore && <span className="font-medium text-destructive">{esito.errore}</span>}
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Scelta dell'articolo del magazzino
// -----------------------------------------------------------------------------
// Usata nel modulo del prodotto di un ordine. Collegare l'articolo è facoltativo:
// serve per scalare i pezzi quando il prodotto passa a "In lavorazione".
// Si può sempre scrivere tutto a mano.

/** Tutte le parole cercate devono comparire nel nome, nella categoria o nei colori (es. "polo nera"). */
function cerca(articoli: ArticoloPerScelta[], testo: string) {
  const parole = paroleRicerca(testo);
  if (parole.length === 0) return [];
  return articoli
    .filter((a) => {
      const dove = normalizzaTesto(`${a.nome} ${a.categoria ?? ""} ${a.varianti.map((v) => v.colore).join(" ")}`);
      return parole.every((p) => dove.includes(p));
    })
    .slice(0, 8); // al massimo 8 risultati
}

/** Ricerca nel magazzino dentro il modulo del prodotto (ordini/modulo-prodotto.tsx). */
export function SceltaArticolo({
  articoli,
  sceltoId,
  onScegli,
}: {
  articoli: ArticoloPerScelta[];
  sceltoId: string | null;
  onScegli: (a: ArticoloPerScelta | null) => void;
}) {
  const [testo, setTesto] = useState(""); // quello che si sta scrivendo nella ricerca
  const scelto = articoli.find((a) => a.id === sceltoId);

  // Articolo già scelto: si mostra il riquadro con il nome e il bottone "Togli".
  if (sceltoId)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-3">
        <Package className="size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="font-bold">{scelto?.nome ?? "Articolo non più in magazzino"}</div>
          {scelto && (
            <div className="text-sm text-muted-foreground">
              {scelto.varianti.reduce((t, v) => t + v.giacenza, 0)} pezzi in magazzino · si scalano quando passa a “In
              lavorazione”
            </div>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onScegli(null)}>
          <X /> Togli
        </Button>
      </div>
    );

  // Nessun articolo scelto: campo di ricerca e, sotto, i risultati mentre si scrive.
  const risultati = cerca(articoli, testo);
  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Cerca nel magazzino"
          value={testo}
          onChange={(ev) => setTesto(ev.target.value)}
          placeholder="Cerca nel magazzino (es. polo, felpa nera)"
          className="pl-12"
        />
      </div>
      {testo.trim() && (
        <div className="grid gap-1 rounded-xl border bg-card p-1.5">
          {risultati.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">Nessun articolo: scrivi la descrizione qui sotto.</p>
          )}
          {risultati.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onScegli(a);
                setTesto("");
              }}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent"
            >
              <span>
                <span className="font-semibold">{a.nome}</span>
                {a.categoria && <span className="text-sm text-muted-foreground"> · {a.categoria}</span>}
              </span>
              <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
                {a.varianti.reduce((t, v) => t + v.giacenza, 0)} pz
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
