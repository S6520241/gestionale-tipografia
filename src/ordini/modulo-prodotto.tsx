"use client";

// =============================================================================
// ordini/modulo-prodotto.tsx — il modulo di un prodotto dell'ordine (nel browser)
// =============================================================================
// Un prodotto ("riga" dell'ordine) ha:
//   1. cosa è: descrizione, tipo, prezzo, articolo del magazzino (facoltativo);
//   2. quanti pezzi: una riga per colore/taglia ("varianti");
//   3. stampa o ricamo: una o più lavorazioni ("applicazioni").
// Le liste sono lunghe a piacere, quindi i valori stanno in React (useState)
// e all'invio si manda un oggetto alla server action salvaRiga, che lo
// controlla con rigaSchema (ordini/regole.ts).
//
// La ricerca dell'articolo del magazzino (SceltaArticolo) è in magazzino/moduli.tsx.

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Button,
  buttonVariants,
  Campo,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Select,
} from "@/comune/componenti";
import type { Esito } from "@/comune/server";
import type { ArticoloPerScelta } from "@/magazzino/database";
import { SceltaArticolo } from "@/magazzino/moduli";
import { chiaveVariante, ordinaTaglie } from "@/magazzino/regole";
import { salvaRiga } from "./azioni";
import { ammetteLavorazioni, ammetteTaglie, POSIZIONI, TECNICHE, TIPI_PRODOTTO } from "./regole";

// -----------------------------------------------------------------------------
// Valori del modulo
// -----------------------------------------------------------------------------

// Nel modulo tutto è testo (come negli <input>); si converte all'invio.
export type VarianteForm = { colore: string; taglia: string; quantita: string };
export type ApplicazioneForm = {
  tecnica: "STAMPA" | "RICAMO" | "ALTRO";
  posizione: string; // "" = nessuna
  colori: string; // separati da virgola
  numeroPunti: string;
  note: string;
};
export type RigaFormValori = {
  articoloId: string | null; // articolo del magazzino collegato (facoltativo)
  descrizione: string;
  tipo: keyof typeof TIPI_PRODOTTO;
  prezzoUnitario: string;
  note: string;
  varianti: VarianteForm[];
  applicazioni: ApplicazioneForm[];
};

const TAGLIE_RAPIDE = ["XS", "S", "M", "L", "XL", "XXL"];
const nuovaVariante = (colore = ""): VarianteForm => ({ colore, taglia: "", quantita: "" });
const nuovaApplicazione = (): ApplicazioneForm => ({
  tecnica: "STAMPA",
  posizione: "",
  colori: "",
  numeroPunti: "",
  note: "",
});

const listaDaTesto = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Valori del modulo -> oggetto per rigaSchema (che poi converte i numeri). */
function inOggetto(v: RigaFormValori) {
  return {
    articoloId: v.articoloId,
    descrizione: v.descrizione,
    tipo: v.tipo,
    prezzoUnitario: v.prezzoUnitario,
    note: v.note,
    // Le righe senza quantità sono righe vuote lasciate nel form: si ignorano.
    varianti: v.varianti.filter((x) => x.quantita.trim() !== ""),
    applicazioni: v.applicazioni.map((a) => ({
      tecnica: a.tecnica,
      posizione: a.posizione === "" ? null : a.posizione,
      note: a.note,
      // I dettagli dipendono dalla tecnica: colori per la stampa, fili e punti per il ricamo.
      parametri:
        a.tecnica === "STAMPA"
          ? { colori: listaDaTesto(a.colori) }
          : a.tecnica === "RICAMO"
            ? { coloriFili: listaDaTesto(a.colori), ...(a.numeroPunti ? { numeroPunti: a.numeroPunti } : {}) }
            : null,
    })),
  };
}

/** Toglie le taglie e somma le quantità delle righe con lo stesso colore (S e M blu -> blu). */
function unisciSenzaTaglia(varianti: VarianteForm[]): VarianteForm[] {
  const perColore = new Map<string, VarianteForm>();
  for (const x of varianti) {
    const chiave = x.colore.trim().toLowerCase();
    const prima = perColore.get(chiave);
    if (!prima) perColore.set(chiave, { ...x, taglia: "" });
    else prima.quantita = String((Number(prima.quantita) || 0) + (Number(x.quantita) || 0) || "");
  }
  return [...perColore.values()];
}

/**
 * Aggiunta veloce: scegli la tecnica, spunta una o più posizioni e premi Aggiungi.
 * Ogni posizione spuntata diventa una lavorazione a sé (con colori e note propri).
 */
function AggiungiLavorazioni({ onAggiungi }: { onAggiungi: (nuove: ApplicazioneForm[]) => void }) {
  const [tecnica, setTecnica] = useState<ApplicazioneForm["tecnica"]>("STAMPA");
  const [posizioni, setPosizioni] = useState<string[]>([]);
  const [dove, setDove] = useState(""); // descrizione libera per la posizione "Altro"

  // Spunta / toglie la spunta a una posizione.
  const alterna = (p: string) => setPosizioni((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));

  function aggiungi() {
    const scelte = posizioni.length > 0 ? posizioni : [""]; // nessuna spunta = senza posizione
    // Le posizioni nell'ordine della lista (Cuore, Spalle, Manica, Altro), non in quello dei clic.
    const ordinate = scelte.sort((a, b) => Object.keys(POSIZIONI).indexOf(a) - Object.keys(POSIZIONI).indexOf(b));
    onAggiungi(
      ordinate.map((posizione) => ({
        ...nuovaApplicazione(),
        tecnica,
        posizione,
        note: posizione === "ALTRO" ? dove.trim() : "",
      })),
    );
    setPosizioni([]);
    setDove("");
  }

  // Stile dei bottoni-scelta: pieni se scelti, bianchi se no.
  const chip = (attivo: boolean) =>
    cn(
      "h-11 rounded-xl border-2 px-4 font-semibold transition",
      attivo ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:border-primary/50",
    );

  return (
    <div className="grid gap-4 rounded-xl bg-primary/5 p-4">
      <div className="grid gap-2">
        <span className="text-[15px] font-semibold">Cosa?</span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TECNICHE).map(([k, t]) => (
            <button
              key={k}
              type="button"
              className={chip(tecnica === k)}
              onClick={() => setTecnica(k as ApplicazioneForm["tecnica"])}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-[15px] font-semibold">Dove? (puoi sceglierne più di una)</span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(POSIZIONI).map(([k, t]) => (
            <button
              key={k}
              type="button"
              aria-pressed={posizioni.includes(k)}
              className={chip(posizioni.includes(k))}
              onClick={() => alterna(k)}
            >
              {posizioni.includes(k) ? "✓ " : ""}
              {t}
            </button>
          ))}
        </div>
        {posizioni.includes("ALTRO") && (
          <Input
            aria-label="Dove esattamente"
            value={dove}
            onChange={(ev) => setDove(ev.target.value)}
            placeholder="Dove esattamente? Es. fronte grande, cappuccio"
          />
        )}
      </div>
      <Button type="button" onClick={aggiungi} className="w-fit">
        + Aggiungi{" "}
        {posizioni.length > 1
          ? `${posizioni.length} ${TECNICHE[tecnica].toLowerCase()}`
          : TECNICHE[tecnica].toLowerCase()}
      </Button>
    </div>
  );
}

/** Sotto ogni colore/taglia: quanti ce ne sono in magazzino (in rosso se non bastano). */
function DisponibiliInMagazzino({ disponibili, richiesti }: { disponibili: number; richiesti: number }) {
  const bastano = disponibili >= richiesti;
  return (
    <p className={cn("col-span-full -mt-1 text-sm", bastano ? "text-muted-foreground" : "font-semibold text-red-700")}>
      In magazzino: {disponibili}
      {!bastano && ` · ne mancano ${richiesti - Math.max(disponibili, 0)} (puoi salvare lo stesso)`}
    </p>
  );
}

// -----------------------------------------------------------------------------
// Il modulo
// -----------------------------------------------------------------------------

/**
 * Nuovo prodotto (senza rigaId) o modifica di uno esistente ("iniziale" = i suoi valori).
 * "articoli" = il magazzino, per la ricerca e per mostrare i pezzi disponibili.
 */
export function RigaForm({
  ordineId,
  rigaId,
  iniziale,
  articoli,
}: {
  ordineId: string;
  rigaId?: string;
  iniziale?: RigaFormValori;
  articoli: ArticoloPerScelta[];
}) {
  const [v, setV] = useState<RigaFormValori>(
    iniziale ?? {
      articoloId: null,
      descrizione: "",
      tipo: "ABBIGLIAMENTO",
      prezzoUnitario: "",
      note: "",
      varianti: [nuovaVariante()],
      applicazioni: [],
    },
  );
  const [esito, setEsito] = useState<Esito>({}); // risposta della server action (errori)
  // useTransition: "pending" è true mentre la server action lavora (il bottone mostra "Salvataggio...").
  const [pending, startTransition] = useTransition();
  const e = esito.errori ?? {};

  // Cambiano un campo di un elemento delle liste. In React lo stato non si modifica
  // "sul posto": si crea una lista nuova (map) con l'elemento i-esimo aggiornato.
  const setVariante = (i: number, campo: keyof VarianteForm, valore: string) =>
    setV((p) => ({ ...p, varianti: p.varianti.map((x, j) => (j === i ? { ...x, [campo]: valore } : x)) }));
  const setApplicazione = (i: number, campo: keyof ApplicazioneForm, valore: string) =>
    setV((p) => ({ ...p, applicazioni: p.applicazioni.map((x, j) => (j === i ? { ...x, [campo]: valore } : x)) }));

  // Come per le lavorazioni: se un vecchio prodotto ha già taglie le mostriamo, così si possono togliere.
  const conTaglie = ammetteTaglie(v.tipo) || v.varianti.some((x) => x.taglia !== "");
  const totale = v.varianti.reduce((s, x) => s + (Number(x.quantita) || 0), 0); // per "(N in tutto)"

  /** "+ Tutte le taglie XS-XXL": una riga per taglia, con il colore dell'ultima riga. */
  function aggiungiTaglie() {
    const colore = v.varianti.at(-1)?.colore ?? "";
    setV((p) => ({
      ...p,
      // Toglie le righe completamente vuote e aggiunge una riga per taglia.
      varianti: [
        ...p.varianti.filter((x) => x.colore || x.taglia || x.quantita),
        ...TAGLIE_RAPIDE.map((taglia) => ({ colore, taglia, quantita: "" })),
      ],
    }));
  }

  // Se un vecchio prodotto ha già lavorazioni non ammesse le mostriamo lo stesso, così si possono togliere.
  const conLavorazioni = ammetteLavorazioni(v.tipo) || v.applicazioni.length > 0;

  // Articolo del magazzino: colori/taglie da suggerire e pezzi disponibili per variante.
  const articolo = articoli.find((a) => a.id === v.articoloId);
  const giacenza = new Map(articolo?.varianti.map((x) => [chiaveVariante(x.colore, x.taglia), x.giacenza]));
  const coloriArticolo = [...new Set(articolo?.varianti.map((x) => x.colore).filter(Boolean))];
  const taglieArticolo = ordinaTaglie([...new Set(articolo?.varianti.map((x) => x.taglia).filter(Boolean))]);

  /** Articolo scelto nella ricerca (null = "Togli"). */
  function scegliArticolo(a: ArticoloPerScelta | null) {
    if (!a) return setV({ ...v, articoloId: null });
    // Il tipo dell'articolo vince (con la solita conferma se toglie qualcosa); la descrizione si propone se vuota.
    const base = { ...v, articoloId: a.id, descrizione: v.descrizione.trim() ? v.descrizione : a.nome };
    if (a.tipo !== v.tipo) cambiaTipo(a.tipo, base);
    else setV(base);
  }

  /**
   * Cambio tipo: se il nuovo tipo non prevede stampa/ricamo o taglie, quelle già
   * inserite vanno tolte (dopo una conferma). "da" = i valori di partenza.
   */
  function cambiaTipo(tipo: RigaFormValori["tipo"], da: RigaFormValori = v) {
    let nuovo: RigaFormValori = { ...da, tipo };
    const daTogliere: string[] = [];
    if (!ammetteLavorazioni(tipo) && da.applicazioni.length > 0) {
      daTogliere.push("le lavorazioni (stampa/ricamo)");
      nuovo = { ...nuovo, applicazioni: [] };
    }
    if (!ammetteTaglie(tipo) && da.varianti.some((x) => x.taglia.trim() !== "")) {
      daTogliere.push("le taglie (i pezzi dello stesso colore verranno sommati)");
      nuovo = { ...nuovo, varianti: unisciSenzaTaglia(da.varianti) };
    }
    if (daTogliere.length > 0) {
      const ok = window.confirm(
        `${TIPI_PRODOTTO[tipo]} non ha stampa, ricamo o taglie: verranno tolte ${daTogliere.join(" e ")}. Continuare?`,
      );
      if (!ok) return; // il select torna da solo al valore precedente (è controllato da React)
    }
    setV(nuovo);
  }

  /** Invio: si manda l'oggetto (non il FormData) alla server action. */
  function invia(ev: React.FormEvent) {
    ev.preventDefault(); // niente invio "classico" del browser: lo facciamo noi qui sotto
    startTransition(async () => {
      // In caso di successo la action fa redirect e non torna qui.
      const r = await salvaRiga(ordineId, rigaId ?? null, inOggetto(v));
      setEsito(r ?? {});
    });
  }

  return (
    <form onSubmit={invia} className="grid gap-6">
      {/* 1. Che prodotto è */}
      <Card>
        <CardHeader>
          <CardTitle>1. Che prodotto è?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Campo
            label="Dal magazzino (facoltativo)"
            className="sm:col-span-3"
            aiuto="Se lo colleghi, i pezzi si scalano dal magazzino quando il prodotto va in lavorazione."
          >
            <SceltaArticolo articoli={articoli} sceltoId={v.articoloId} onScegli={scegliArticolo} />
          </Campo>
          <Campo label="Descrizione *" htmlFor="descrizione" errore={e.descrizione} className="sm:col-span-2">
            <Input
              id="descrizione"
              value={v.descrizione}
              onChange={(x) => setV({ ...v, descrizione: x.target.value })}
              placeholder="Es. Magliette cotone, Adesivi 10x10"
              required
            />
          </Campo>
          <Campo label="Tipo" htmlFor="tipo">
            <Select id="tipo" value={v.tipo} onChange={(x) => cambiaTipo(x.target.value as RigaFormValori["tipo"])}>
              {Object.entries(TIPI_PRODOTTO).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Prezzo unitario (IVA esclusa)" htmlFor="prezzo" errore={e.prezzoUnitario}>
            <Input
              id="prezzo"
              inputMode="decimal"
              value={v.prezzoUnitario}
              onChange={(x) => setV({ ...v, prezzoUnitario: x.target.value })}
              placeholder="Es. 8,50 (facoltativo)"
            />
          </Campo>
          <Campo label="Note" htmlFor="noteRiga" className="sm:col-span-2">
            <Input id="noteRiga" value={v.note} onChange={(x) => setV({ ...v, note: x.target.value })} />
          </Campo>
        </CardContent>
      </Card>

      {/* 2. Quanti pezzi: una riga per colore/taglia */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>2. Quanti pezzi? ({totale} in tutto)</CardTitle>
          <div className="flex gap-2">
            {conTaglie && (
              <Button type="button" variant="outline" size="sm" onClick={aggiungiTaglie}>
                + Tutte le taglie XS-XXL
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setV({ ...v, varianti: [...v.varianti, nuovaVariante(v.varianti.at(-1)?.colore)] })}
            >
              + Altra riga
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            {conTaglie
              ? "Una riga per ogni colore e taglia. Le righe senza quantità vengono ignorate."
              : "Una riga per colore (lascia vuoto se non serve). Le righe senza quantità vengono ignorate."}
          </p>
          {/* key={i}: le righe del modulo non hanno un id, si usa la posizione. */}
          {v.varianti.map((x, i) => (
            <div
              key={i}
              className={cn(
                "grid gap-2",
                conTaglie ? "grid-cols-[1fr_5rem_5.5rem_auto]" : "grid-cols-[1fr_5.5rem_auto]",
              )}
            >
              <Input
                aria-label="Colore"
                placeholder="Colore"
                list={articolo ? "colori-articolo" : undefined}
                value={x.colore}
                onChange={(ev) => setVariante(i, "colore", ev.target.value)}
              />
              {conTaglie && (
                <Input
                  aria-label="Taglia"
                  placeholder="Taglia"
                  list={articolo ? "taglie-articolo" : undefined}
                  value={x.taglia}
                  onChange={(ev) => setVariante(i, "taglia", ev.target.value)}
                />
              )}
              <Input
                aria-label="Quantità"
                placeholder="Q.tà"
                inputMode="numeric"
                value={x.quantita}
                onChange={(ev) => setVariante(i, "quantita", ev.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-12"
                aria-label="Togli variante"
                onClick={() => setV({ ...v, varianti: v.varianti.filter((_, j) => j !== i) })}
              >
                ✕
              </Button>
              {articolo && (x.colore || x.taglia) && (
                <DisponibiliInMagazzino
                  disponibili={giacenza.get(chiaveVariante(x.colore, conTaglie ? x.taglia : "")) ?? 0}
                  richiesti={Number(x.quantita) || 0}
                />
              )}
              {(e[`varianti.${i}.quantita`] || e[`varianti.${i}.taglia`]) && (
                <p className="col-span-full text-sm text-destructive">
                  {e[`varianti.${i}.quantita`] ?? e[`varianti.${i}.taglia`]}
                </p>
              )}
            </div>
          ))}
          {e.varianti && <p className="text-sm text-destructive">{e.varianti}</p>}
          {/* I colori e le taglie dell'articolo, suggeriti nei campi qui sopra (list="..."). */}
          {articolo && (
            <>
              <datalist id="colori-articolo">
                {coloriArticolo.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <datalist id="taglie-articolo">
                {taglieArticolo.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. Stampa o ricamo: prima l'aggiunta veloce, poi una scheda per ogni lavorazione */}
      {conLavorazioni && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>3. Stampa o ricamo? (facoltativo)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ammetteLavorazioni(v.tipo) && (
              <AggiungiLavorazioni
                onAggiungi={(nuove) => setV({ ...v, applicazioni: [...v.applicazioni, ...nuove] })}
              />
            )}
            {e.applicazioni && <p className="text-sm font-medium text-destructive">{e.applicazioni}</p>}
            {v.applicazioni.map((a, i) => (
              <div key={i} className="grid gap-3 rounded-xl border-2 bg-card p-4 sm:grid-cols-4">
                <p className="font-bold sm:col-span-4">
                  {i + 1}. {TECNICHE[a.tecnica]}
                  {a.posizione && ` · ${POSIZIONI[a.posizione as keyof typeof POSIZIONI]}`}
                </p>
                <Campo label="Tecnica">
                  <Select value={a.tecnica} onChange={(ev) => setApplicazione(i, "tecnica", ev.target.value)}>
                    {Object.entries(TECNICHE).map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Campo>
                <Campo label="Posizione">
                  <Select value={a.posizione} onChange={(ev) => setApplicazione(i, "posizione", ev.target.value)}>
                    <option value="">Nessuna</option>
                    {Object.entries(POSIZIONI).map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Campo>
                {a.tecnica !== "ALTRO" && (
                  <Campo
                    label={a.tecnica === "RICAMO" ? "Colori dei fili" : "Colori di stampa"}
                    className={a.tecnica === "STAMPA" ? "sm:col-span-2" : ""}
                  >
                    <Input
                      value={a.colori}
                      placeholder="Separati da virgola"
                      onChange={(ev) => setApplicazione(i, "colori", ev.target.value)}
                    />
                  </Campo>
                )}
                {a.tecnica === "RICAMO" && (
                  <Campo label="Numero punti" errore={e[`applicazioni.${i}.parametri.numeroPunti`]}>
                    <Input
                      inputMode="numeric"
                      value={a.numeroPunti}
                      placeholder="Facoltativo"
                      onChange={(ev) => setApplicazione(i, "numeroPunti", ev.target.value)}
                    />
                  </Campo>
                )}
                <Campo
                  label={a.posizione === "ALTRO" ? "Dove esattamente / note" : "Note"}
                  className={a.tecnica === "ALTRO" ? "sm:col-span-2" : "sm:col-span-3"}
                >
                  <Input
                    value={a.note}
                    placeholder={a.posizione === "ALTRO" ? "Es. fronte grande, cappuccio" : "Es. logo 8 cm"}
                    onChange={(ev) => setApplicazione(i, "note", ev.target.value)}
                  />
                </Campo>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-end"
                  onClick={() => setV({ ...v, applicazioni: v.applicazioni.filter((_, j) => j !== i) })}
                >
                  Togli
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="xl" variant="success" disabled={pending}>
          {pending ? "Salvataggio..." : rigaId ? "Salva modifiche" : "✓ Aggiungi all'ordine"}
        </Button>
        <Link href={`/ordini/${ordineId}`} className={buttonVariants({ variant: "ghost" })}>
          Annulla
        </Link>
        {esito.errore && <span className="font-medium text-destructive">{esito.errore}</span>}
      </div>
    </form>
  );
}
