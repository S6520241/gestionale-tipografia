// =============================================================================
// ordini/scheda-prodotto.tsx — la scheda di un prodotto nella pagina dell'ordine
// =============================================================================
// Pensata per chi non è pratico: una domanda alla volta ("A che punto è?",
// "Quanti pezzi sono pronti?") con bottoni grandi. Le cose meno frequenti
// (storico, annulla) stanno chiuse in "Storico e altre azioni".
//
// È un componente del server: i bottoni sono piccoli <form> (FormAzione) che
// chiamano le server action, quindi qui non serve "use client". L'unico pezzo
// interattivo, il contatore dei pezzi pronti, è PezziPronti in ordini/moduli.tsx.

import Link from "next/link";
import { Check, ChevronDown, History, Package, Pencil, Undo2, XCircle } from "lucide-react";
import { buttonVariants, Card, cn } from "@/comune/componenti";
import { BottoneInvio, FormAzione } from "@/comune/moduli";
import { formattaDataOra, formattaEuro } from "@/comune/regole";
import { impostaFase, impostaQuantitaPronta } from "./azioni";
import { BadgeStatoRiga } from "./componenti";
import type { RigaDettaglio } from "./database";
import { PezziPronti } from "./moduli";
import {
  MODALITA_CONFERMA,
  parametriRicamoSchema,
  parametriStampaSchema,
  POSIZIONI,
  STATI_RIGA,
  TECNICHE,
  TIPI_PRODOTTO,
} from "./regole";

/** Una lavorazione in una riga di testo, es. "Cuore · Bianco, Rosso". */
function descriviApplicazione(a: RigaDettaglio["applicazioni"][number]) {
  const parti: string[] = [];
  if (a.posizione) parti.push(POSIZIONI[a.posizione]);
  // "parametri" è un campo JSON: lo si rilegge con lo schema Zod per sapere cosa contiene.
  if (a.tecnica === "STAMPA") {
    const p = parametriStampaSchema.safeParse(a.parametri);
    if (p.success && p.data.colori.length) parti.push(p.data.colori.join(", "));
  }
  if (a.tecnica === "RICAMO") {
    const p = parametriRicamoSchema.safeParse(a.parametri);
    if (p.success && p.data.coloriFili.length) parti.push(`fili ${p.data.coloriFili.join(", ")}`);
    if (p.success && p.data.numeroPunti) parti.push(`${p.data.numeroPunti.toLocaleString("it-IT")} punti`);
  }
  if (a.note) parti.push(a.note);
  return parti.join(" · ");
}

// Le fasi che sceglie una persona, in ordine, con il colore del bottone quando è quella attuale.
// "Pronta" e "Ritirata" non ci sono: vengono dai pezzi pronti e dalle consegne.
const FASI = [
  { stato: "DA_FARE", testo: "Da fare", attivo: "bg-slate-600 text-white border-slate-600" },
  { stato: "BOZZA_INVIATA", testo: "Bozza inviata", attivo: "bg-violet-600 text-white border-violet-600" },
  { stato: "BOZZA_CONFERMATA", testo: "Bozza approvata", attivo: "bg-sky-600 text-white border-sky-600" },
  { stato: "IN_LAVORAZIONE", testo: "In lavorazione", attivo: "bg-amber-500 text-white border-amber-500" },
] as const;

const stileFase =
  "flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-sm font-semibold transition";

/** La scheda di un prodotto. "numero" = il pallino 1, 2, 3... in alto a sinistra. */
export function RigaCard({ ordineId, riga, numero }: { ordineId: string; riga: RigaDettaglio; numero: number }) {
  const annullata = riga.stato === "ANNULLATA";
  const indiceAttuale = FASI.findIndex((f) => f.stato === riga.stato); // -1 se annullata
  const totaleRiga = riga.prezzoUnitario ? riga.prezzoUnitario.mul(riga.quantitaTotale) : null;
  // .bind(null, a, b...) crea una nuova funzione con i primi argomenti già fissati:
  // il <form> poi la chiama aggiungendo solo i suoi (stato precedente e dati del modulo).
  const fase = (stato: (typeof FASI)[number]["stato"]) =>
    impostaFase.bind(null, ordineId, riga.id, stato, undefined, true);

  return (
    <Card className={cn("overflow-hidden", annullata && "opacity-60")}>
      {/* Intestazione */}
      <div className="flex flex-wrap items-start gap-3 border-b bg-muted/40 p-5 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
          {numero}
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold">{riga.descrizione}</h3>
            <BadgeStatoRiga stato={riga.statoMostrato} grande />
          </div>
          <p className="text-muted-foreground">
            {TIPI_PRODOTTO[riga.tipo]} · <strong className="text-foreground">{riga.quantitaTotale} pezzi</strong>
            {riga.prezzoUnitario && ` · ${formattaEuro(riga.prezzoUnitario)} l'uno = ${formattaEuro(totaleRiga!)}`}
          </p>
          {riga.articolo && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                href={`/magazzino/${riga.articolo.id}`}
                className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <Package className="size-4" /> {riga.articolo.nome}
              </Link>
              {riga.pezziPresi > 0 ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                  ✓ {riga.pezziPresi} pezzi presi dal magazzino
                </span>
              ) : (
                !annullata && (
                  <span className="text-muted-foreground">
                    si scalano dal magazzino quando passa a “In lavorazione”
                  </span>
                )
              )}
            </p>
          )}
        </div>
        <Link
          href={`/ordini/${ordineId}/righe/${riga.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Pencil /> Modifica
        </Link>
      </div>

      <div className="grid gap-6 p-5 sm:px-6">
        {/* Cosa c'è da fare: taglie e lavorazioni */}
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {riga.varianti.map((v) => (
              <span key={v.id} className="rounded-xl border bg-card px-3 py-1.5 text-[15px]">
                {[v.colore, v.taglia].filter(Boolean).join(" ") || "Pezzi"} <strong>× {v.quantita}</strong>
              </span>
            ))}
          </div>
          {riga.applicazioni.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {riga.applicazioni.map((a) => (
                <span
                  key={a.id}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-[15px]",
                    a.tecnica === "RICAMO"
                      ? "bg-fuchsia-50 text-fuchsia-900"
                      : a.tecnica === "STAMPA"
                        ? "bg-indigo-50 text-indigo-900"
                        : "bg-slate-100",
                  )}
                >
                  <strong>{TECNICHE[a.tecnica]}</strong>
                  {descriviApplicazione(a) && ` · ${descriviApplicazione(a)}`}
                </span>
              ))}
            </div>
          )}
          {riga.note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">📝 {riga.note}</p>}
        </div>

        {/* Prodotto annullato: al posto delle domande, solo il bottone per ripristinarlo. */}
        {annullata ? (
          <FormAzione action={impostaFase.bind(null, ordineId, riga.id, "DA_FARE", undefined, true)}>
            <BottoneInvio variant="outline">
              <Undo2 /> Ripristina questo prodotto
            </BottoneInvio>
          </FormAzione>
        ) : (
          <>
            {/* Domanda 1: le fasi già passate sono grigie con la spunta, quella attuale è colorata. */}
            <div className="grid gap-3">
              <p className="font-semibold">A che punto è?</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {FASI.map((f, i) => {
                  const classe = cn(
                    stileFase,
                    i === indiceAttuale
                      ? f.attivo
                      : i < indiceAttuale
                        ? "border-transparent bg-muted text-muted-foreground"
                        : "border-input bg-card hover:border-primary/50 hover:bg-accent",
                  );
                  const contenuto = (
                    <>
                      {i <= indiceAttuale && <Check className="size-4" />} {f.testo}
                    </>
                  );
                  // "Bozza approvata" chiede come: due scelte in un menu che si apre.
                  // <details>/<summary> è un menu che si apre e chiude da solo, senza JavaScript.
                  if (f.stato === "BOZZA_CONFERMATA" && i !== indiceAttuale) {
                    return (
                      <details key={f.stato} className="group relative">
                        <summary className={cn(classe, "cursor-pointer")}>
                          {contenuto} <ChevronDown className="size-4" />
                        </summary>
                        <div className="absolute inset-x-0 top-full z-10 mt-1 grid gap-1 rounded-xl border bg-card p-1.5 shadow-lg">
                          {(["IN_SEDE", "A_DISTANZA"] as const).map((m) => (
                            <FormAzione
                              key={m}
                              action={impostaFase.bind(null, ordineId, riga.id, "BOZZA_CONFERMATA", m, true)}
                            >
                              <BottoneInvio variant="ghost" size="sm" className="w-full justify-start">
                                {MODALITA_CONFERMA[m]}
                              </BottoneInvio>
                            </FormAzione>
                          ))}
                        </div>
                      </details>
                    );
                  }
                  return (
                    <FormAzione key={f.stato} action={fase(f.stato)}>
                      <button className={classe} disabled={i === indiceAttuale}>
                        {contenuto}
                      </button>
                    </FormAzione>
                  );
                })}
              </div>
            </div>

            {/* Domanda 2. key={...}: quando i pronti cambiano sul server, il contatore riparte dal valore nuovo. */}
            <div className="grid gap-3">
              <p className="font-semibold">
                Quanti pezzi sono pronti?
                {riga.quantitaConsegnata > 0 && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    ({riga.quantitaConsegnata} già ritirati)
                  </span>
                )}
              </p>
              <PezziPronti
                key={riga.quantitaPronta}
                action={impostaQuantitaPronta.bind(null, ordineId, riga.id)}
                pronti={riga.quantitaPronta}
                totale={riga.quantitaTotale}
                minimo={riga.quantitaConsegnata}
              />
            </div>
          </>
        )}

        {/* Altro: storico e annulla, chiusi di default */}
        <details className="group rounded-xl border">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground">
            <span className="flex items-center gap-2">
              <History className="size-4" /> Storico e altre azioni
            </span>
            <ChevronDown className="size-4 transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 border-t p-4">
            {riga.bozze.length + riga.storicoStati.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun cambiamento registrato.</p>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {riga.bozze.map((b) => (
                  <li key={b.id}>
                    Bozza {b.inviataIl ? `inviata il ${formattaDataOra(b.inviataIl)}` : "mostrata in negozio"}
                    {b.confermataIl &&
                      ` · approvata il ${formattaDataOra(b.confermataIl)} (${b.modalita ? MODALITA_CONFERMA[b.modalita].toLowerCase() : ""}${b.confermataDa?.name ? `, ${b.confermataDa.name}` : ""})`}
                  </li>
                ))}
                {riga.storicoStati.map((s) => (
                  <li key={s.id} className="text-muted-foreground">
                    {formattaDataOra(s.data)} · {s.utente.name ?? "?"}: {s.da ? STATI_RIGA[s.da] : "-"} →{" "}
                    {STATI_RIGA[s.a]}
                  </li>
                ))}
              </ul>
            )}
            {!annullata && riga.pezziPresi === 0 && (
              <FormAzione
                action={impostaFase.bind(null, ordineId, riga.id, "ANNULLATA", undefined, true)}
                conferma="Annullare questo prodotto? Resterà nello storico dell'ordine."
              >
                <BottoneInvio variant="outline" size="sm" className="w-fit text-destructive">
                  <XCircle /> Annulla questo prodotto
                </BottoneInvio>
              </FormAzione>
            )}
            {!annullata && riga.pezziPresi > 0 && (
              // Il prodotto ha già preso pezzi dal magazzino: chiediamo cosa farne.
              <div className="grid gap-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                <p className="font-semibold">
                  Annullare questo prodotto? Rimetto i {riga.pezziPresi} pezzi in magazzino?
                </p>
                <div className="flex flex-wrap gap-2">
                  <FormAzione action={impostaFase.bind(null, ordineId, riga.id, "ANNULLATA", undefined, true)}>
                    <BottoneInvio variant="outline" size="sm" className="text-destructive">
                      <XCircle /> Annulla e rimetti i pezzi in magazzino
                    </BottoneInvio>
                  </FormAzione>
                  <FormAzione action={impostaFase.bind(null, ordineId, riga.id, "ANNULLATA", undefined, false)}>
                    <BottoneInvio variant="outline" size="sm" className="text-destructive">
                      <XCircle /> Annulla: i pezzi sono già usati
                    </BottoneInvio>
                  </FormAzione>
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    </Card>
  );
}
