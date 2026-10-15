// =============================================================================
// /ordini/[id] — la pagina di un ordine
// =============================================================================
// Dall'alto in basso:
//   1. intestazione: cliente, stato, pagamento, consegna, barra dei pezzi;
//   2. i prodotti, uno per scheda (RigaCard in ordini/scheda-prodotto.tsx);
//   3. ritiro del cliente (anche di una parte dei pezzi) e ritiri già fatti;
//   4. pagamento: totale, già pagato, da pagare, acconti e saldo;
//   5. chiuso in "Modifica...": dati dell'ordine, annulla, archivia.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, Phone, Plus, Settings, Truck, Wallet } from "lucide-react";
import { clientiPerSelect } from "@/clienti/database";
import { Badge, buttonVariants, Card, Textarea } from "@/comune/componenti";
import { BottoneInvio, FormAzione } from "@/comune/moduli";
import { formattaDataOra, formattaEuro, giornoISO } from "@/comune/regole";
import { annullaConsegna, annullaOrdine, annullaPagamento, archiviaOrdine, registraConsegna } from "@/ordini/azioni";
import { formattaNumeroOrdine, isOrdineAperto } from "@/ordini/calcoli";
import { Avanzamento, BadgePagamento, BadgeStatoOrdine, BadgeUrgente, Scadenza } from "@/ordini/componenti";
import { leggiOrdine } from "@/ordini/database";
import { BottoniPagamento, OrdineForm } from "@/ordini/moduli";
import { RigaCard } from "@/ordini/scheda-prodotto";

// Il titolo della scheda del browser dipende dall'ordine: per questo è una funzione e non un oggetto fisso.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ordine = await leggiOrdine((await params).id);
  return { title: ordine ? `Ordine ${formattaNumeroOrdine(ordine)}` : "Ordine" };
}

export default async function OrdinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ordine, clienti] = await Promise.all([leggiOrdine(id), clientiPerSelect()]);
  if (!ordine) notFound();

  const aperto = isOrdineAperto(ordine.stato);
  const righeAttive = ordine.righe.filter((r) => r.stato !== "ANNULLATA");
  const { totale, pagamento } = ordine;
  const pezziPresi = righeAttive.reduce((t, r) => t + r.pezziPresi, 0); // presi dal magazzino, da tutti i prodotti
  // Righe con pezzi pronti non ancora ritirati: sono quelle consegnabili.
  const consegnabili = righeAttive.filter((r) => r.quantitaPronta > r.quantitaConsegnata);

  return (
    <div className="grid gap-6">
      <Link
        href="/ordini"
        className="flex w-fit items-center gap-2 font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-5" /> Tutti gli ordini
      </Link>

      {/* Intestazione: chi, quando, a che punto */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400" />
        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-muted-foreground">Ordine {formattaNumeroOrdine(ordine)}</p>
            <Link href={`/clienti/${ordine.cliente.id}`} className="w-fit text-3xl font-extrabold hover:text-primary">
              {ordine.cliente.nome}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <BadgeStatoOrdine stato={ordine.stato} grande />
              {ordine.urgente && aperto && <BadgeUrgente />}
              {ordine.stato !== "VUOTO" && ordine.stato !== "ANNULLATO" && <BadgePagamento p={pagamento} grande />}
              {ordine.archiviato && <Badge colore="rosso">Archiviato</Badge>}
            </div>
            {ordine.cliente.telefono && (
              <a
                href={`tel:${ordine.cliente.telefono.replace(/\s/g, "")}`}
                className="flex w-fit items-center gap-2 font-semibold text-primary"
              >
                <Phone className="size-4" /> {ordine.cliente.telefono}
              </a>
            )}
          </div>
          <div className="grid content-start gap-1 rounded-2xl bg-muted/60 p-4 md:min-w-64">
            <span className="text-sm font-semibold text-muted-foreground">Consegna</span>
            <Scadenza data={ordine.dataConsegna} aperto={aperto} grande />
            {totale && (
              <span className="mt-2 text-sm text-muted-foreground">
                Totale <strong className="text-base text-foreground">{formattaEuro(totale.imponibile)}</strong> + IVA
              </span>
            )}
          </div>
          <div className="md:col-span-2">
            <Avanzamento {...ordine.pezzi} grande />
          </div>
          {ordine.note && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 whitespace-pre-line text-amber-900 md:col-span-2">
              📝 {ordine.note}
            </p>
          )}
        </div>
      </Card>

      {/* Prodotti */}
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Prodotti ({ordine.righe.length})</h2>
          <Link href={`/ordini/${ordine.id}/righe/nuova`} className={buttonVariants({ size: "lg" })}>
            <Plus /> Aggiungi prodotto
          </Link>
        </div>
        {ordine.righe.length === 0 && (
          <Link
            href={`/ordini/${ordine.id}/righe/nuova`}
            className="rounded-2xl border-2 border-dashed p-10 text-center text-lg font-semibold text-muted-foreground hover:border-primary hover:text-primary"
          >
            Nessun prodotto: tocca qui per aggiungere il primo
          </Link>
        )}
        {ordine.righe.map((r, i) => (
          <RigaCard key={r.id} ordineId={ordine.id} riga={r} numero={i + 1} />
        ))}
      </section>

      {/* Ritiro da parte del cliente */}
      {(consegnabili.length > 0 || ordine.consegne.length > 0) && (
        <Card className="overflow-hidden border-emerald-200">
          <div className="flex items-center gap-3 bg-emerald-50 px-5 py-4 sm:px-6">
            <Truck className="size-6 text-emerald-700" />
            <h2 className="text-xl font-bold text-emerald-900">Ritiro del cliente</h2>
          </div>
          <div className="grid gap-5 p-5 sm:px-6">
            {consegnabili.length > 0 && (
              // Un campo numerico "q_<id>" per ogni prodotto: registraConsegna (ordini/azioni.ts) li raccoglie.
              <FormAzione action={registraConsegna.bind(null, ordine.id)} className="grid gap-4">
                <p className="text-muted-foreground">
                  Quanti pezzi porta via adesso? Sono già scritti tutti quelli pronti: cambia il numero se ne prende
                  meno.
                </p>
                <div className="grid gap-2">
                  {consegnabili.map((r) => {
                    const max = r.quantitaPronta - r.quantitaConsegnata;
                    return (
                      <label
                        key={r.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-base"
                      >
                        <input
                          name={`q_${r.id}`}
                          type="number"
                          min={0}
                          max={max}
                          defaultValue={max}
                          className="h-12 w-20 rounded-xl border-2 border-input text-center text-lg font-bold"
                        />
                        <span className="font-semibold">{r.descrizione}</span>
                        <span className="text-sm text-muted-foreground">({max} pronti)</span>
                      </label>
                    );
                  })}
                </div>
                <Textarea name="note" placeholder="Note (facoltative), es. ritirato dal figlio" className="min-h-14" />
                <BottoneInvio variant="success" size="xl" className="w-full sm:w-fit">
                  <Truck /> Registra il ritiro
                </BottoneInvio>
              </FormAzione>
            )}

            {ordine.consegne.length > 0 && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-muted-foreground">Ritiri registrati</p>
                {ordine.consegne.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
                    <span className={c.annullata ? "text-muted-foreground line-through" : undefined}>
                      <strong>{formattaDataOra(c.data)}</strong> ·{" "}
                      {c.righe.map((cr) => `${cr.riga.descrizione} × ${cr.quantita}`).join(", ")}
                      {c.note && ` · ${c.note}`} <span className="text-muted-foreground">({c.utente.name ?? "?"})</span>
                    </span>
                    {c.annullata ? (
                      <Badge colore="rosso">Annullato</Badge>
                    ) : (
                      <FormAzione
                        action={annullaConsegna.bind(null, ordine.id, c.id)}
                        conferma="Annullare questo ritiro? I pezzi torneranno da ritirare."
                      >
                        <BottoneInvio variant="ghost" size="sm" className="ml-auto text-destructive">
                          Annulla
                        </BottoneInvio>
                      </FormAzione>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Pagamento: calcolato dai movimenti (vedi statoPagamento in ordini/calcoli.ts) */}
      {ordine.stato !== "VUOTO" && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/50 px-5 py-4 sm:px-6">
            <h2 className="flex items-center gap-3 text-xl font-bold">
              <Wallet className="size-6 text-primary" /> Pagamento
            </h2>
            <BadgePagamento p={pagamento} grande />
          </div>
          <div className="grid gap-5 p-5 sm:px-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="text-sm text-muted-foreground">Totale</div>
                <div className="text-lg font-bold">{totale ? formattaEuro(totale.daIncassare) : "—"}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-sm text-emerald-800">Già pagato</div>
                <div className="text-lg font-bold text-emerald-900">{formattaEuro(pagamento.pagato)}</div>
              </div>
              <div
                className={pagamento.stato === "PAGATO" ? "rounded-xl bg-emerald-50 p-3" : "rounded-xl bg-red-50 p-3"}
              >
                <div className="text-sm text-muted-foreground">Da pagare</div>
                <div className="text-lg font-bold">
                  {pagamento.stato === "PAGATO"
                    ? "Niente"
                    : pagamento.daPagare
                      ? formattaEuro(pagamento.daPagare)
                      : "—"}
                </div>
              </div>
            </div>
            {!totale && (
              <p className="text-sm text-muted-foreground">
                Nessun prodotto ha un prezzo: segna gli acconti e, alla fine, &quot;Ha pagato tutto&quot;.
              </p>
            )}
            {pagamento.stato !== "PAGATO" && (
              // key: quando si aggiunge un pagamento cambia, e React ricrea i bottoni (chiusi e vuoti).
              <BottoniPagamento
                key={ordine.pagamenti.length}
                ordineId={ordine.id}
                // Decimal non si può passare a un componente del browser: lo si passa come testo "12,50".
                daPagare={pagamento.daPagare ? pagamento.daPagare.toFixed(2).replace(".", ",") : null}
              />
            )}
            {ordine.pagamenti.length > 0 && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-muted-foreground">Pagamenti registrati</p>
                {ordine.pagamenti.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-4 py-3">
                    <span className={p.annullato ? "text-muted-foreground line-through" : undefined}>
                      <strong>{formattaDataOra(p.data)}</strong> · {p.tipo === "ACCONTO" ? "Acconto" : "Saldo"}
                      {p.importo && ` ${formattaEuro(p.importo)}`}
                      {p.note && ` · ${p.note}`} <span className="text-muted-foreground">({p.utente.name ?? "?"})</span>
                    </span>
                    {p.annullato ? (
                      <Badge colore="rosso">Annullato</Badge>
                    ) : (
                      <FormAzione
                        action={annullaPagamento.bind(null, ordine.id, p.id)}
                        conferma="Annullare questo pagamento? Resterà nello storico, barrato."
                      >
                        <BottoneInvio variant="ghost" size="sm" className="ml-auto text-destructive">
                          Annulla
                        </BottoneInvio>
                      </FormAzione>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Modifiche meno frequenti: chiuse di default */}
      <details className="group rounded-2xl border bg-card">
        <summary className="flex cursor-pointer items-center justify-between p-5 font-semibold sm:px-6">
          <span className="flex items-center gap-2">
            <Settings className="size-5 text-muted-foreground" /> Modifica cliente, data o note dell&apos;ordine
          </span>
          <ChevronDown className="size-5 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-6 border-t p-5 sm:p-6">
          <OrdineForm
            clienti={
              // Se il cliente è archiviato non è nella lista: lo aggiungiamo per non perderlo.
              clienti.some((c) => c.id === ordine.clienteId)
                ? clienti
                : [...clienti, { id: ordine.cliente.id, nome: ordine.cliente.nome }]
            }
            ordine={{
              id: ordine.id,
              clienteId: ordine.clienteId,
              dataConsegna: ordine.dataConsegna ? giornoISO(ordine.dataConsegna) : null,
              urgente: ordine.urgente,
              note: ordine.note,
            }}
          />
          <div className="flex flex-wrap items-center gap-2 border-t pt-5">
            {/* "Annulla ordine" c'è sempre, così non ci si chiede dove sia finito:
                - con prodotti: li annulla tutti (restano nello storico);
                - ordine vuoto: non c'è niente da annullare, quindi lo toglie dagli elenchi (archivia);
                - già annullato: solo una scritta. */}
            {ordine.stato === "ANNULLATO" ? (
              <span className="rounded-xl bg-red-50 px-4 py-2 font-semibold text-red-800">
                Questo ordine è già annullato
              </span>
            ) : righeAttive.length > 0 && pezziPresi > 0 ? (
              // Alcuni prodotti hanno già preso pezzi dal magazzino: chiediamo cosa farne.
              <div className="grid w-full gap-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                <p className="font-semibold">
                  Annullare tutto l&apos;ordine? Rimetto i {pezziPresi} pezzi presi in magazzino?
                </p>
                <div className="flex flex-wrap gap-2">
                  <FormAzione action={annullaOrdine.bind(null, ordine.id, true)}>
                    <BottoneInvio variant="destructive">Annulla e rimetti i pezzi in magazzino</BottoneInvio>
                  </FormAzione>
                  <FormAzione action={annullaOrdine.bind(null, ordine.id, false)}>
                    <BottoneInvio variant="destructive">Annulla: i pezzi sono già usati</BottoneInvio>
                  </FormAzione>
                </div>
              </div>
            ) : righeAttive.length > 0 ? (
              <FormAzione
                action={annullaOrdine.bind(null, ordine.id, true)}
                conferma="Annullare tutto l'ordine? Resterà nello storico."
              >
                <BottoneInvio variant="destructive">Annulla ordine</BottoneInvio>
              </FormAzione>
            ) : (
              !ordine.archiviato && (
                <FormAzione
                  action={archiviaOrdine.bind(null, ordine.id, true)}
                  conferma="L'ordine non ha prodotti: verrà tolto dagli elenchi. Continuare?"
                >
                  <BottoneInvio variant="destructive">Annulla ordine</BottoneInvio>
                </FormAzione>
              )
            )}
            {ordine.stato !== "VUOTO" && (
              <FormAzione
                action={archiviaOrdine.bind(null, ordine.id, !ordine.archiviato)}
                conferma={
                  ordine.archiviato
                    ? undefined
                    : "Archiviare? L'ordine sparisce dagli elenchi (per ordini di prova o doppi)."
                }
              >
                <BottoneInvio variant="outline">
                  {ordine.archiviato ? "Ripristina dall'archivio" : "Archivia (ordine di prova o doppio)"}
                </BottoneInvio>
              </FormAzione>
            )}
            {ordine.stato === "VUOTO" && ordine.archiviato && (
              <FormAzione action={archiviaOrdine.bind(null, ordine.id, false)}>
                <BottoneInvio variant="outline">Ripristina dall&apos;archivio</BottoneInvio>
              </FormAzione>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ricevuto il {formattaDataOra(ordine.dataRicezione)} da {ordine.creatoDa.name ?? ordine.creatoDa.email}
          </p>
        </div>
      </details>
    </div>
  );
}
