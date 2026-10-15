"use server";

// =============================================================================
// ordini/azioni.ts — server action degli ordini
// =============================================================================
// Ognuna fa: utente loggato -> controllo dei dati con Zod -> ordini/database.ts
// -> aggiorna le pagine. Le regole vere sono in ordini/database.ts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { utenteCorrente } from "@/auth";
import { erroriPerCampo, type Esito, esegui, formDataInOggetto } from "@/comune/server";
import * as ordini from "./database";
import { consegnaSchema, ordineSchema, pagamentoSchema, quantitaProntaSchema, rigaSchema } from "./regole";

/** Dopo una modifica: ridisegna la pagina dell'ordine, l'elenco ordini e la pagina Oggi. */
function aggiorna(ordineId: string) {
  revalidatePath(`/ordini/${ordineId}`);
  revalidatePath("/ordini");
  revalidatePath("/");
}

// -----------------------------------------------------------------------------
// Ordine
// -----------------------------------------------------------------------------

/** Modulo dell'ordine: crea (id = null) o modifica. */
export async function salvaOrdine(id: string | null, _prev: Esito, fd: FormData): Promise<Esito> {
  const utente = await utenteCorrente();
  const valori = formDataInOggetto(fd);
  const parsed = ordineSchema.safeParse(valori);
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error), valori };

  let nuovoId = id;
  const esito = await esegui(async () => {
    if (id) await ordini.aggiornaOrdine(id, parsed.data);
    else nuovoId = (await ordini.creaOrdine(parsed.data, utente.id)).id;
  });
  if (esito.errore) return { ...esito, valori };

  aggiorna(nuovoId!);
  // Nuovo ordine: si va subito ad aggiungere il primo prodotto.
  if (!id) redirect(`/ordini/${nuovoId}/righe/nuova`);
  return { ok: true };
}

/** "Annulla ordine". rimetti = i pezzi già presi dal magazzino ci tornano. */
export async function annullaOrdine(id: string, rimetti = true): Promise<Esito> {
  const utente = await utenteCorrente();
  const esito = await esegui(() => ordini.annullaOrdine(id, utente.id, { rimetti }));
  aggiorna(id);
  return esito;
}

/** "Archivia" / "Ripristina" (nasconde l'ordine dagli elenchi). */
export async function archiviaOrdine(id: string, archiviato: boolean): Promise<Esito> {
  await utenteCorrente();
  const esito = await esegui(() => ordini.impostaOrdineArchiviato(id, archiviato));
  aggiorna(id);
  return esito;
}

// -----------------------------------------------------------------------------
// Prodotti (righe)
// -----------------------------------------------------------------------------

/**
 * Chiamata dal modulo RigaForm con un oggetto (non FormData): varianti e
 * applicazioni sono liste lunghe a piacere, più comode come oggetto.
 * "dati" arriva dal browser, quindi è unknown finché Zod non lo controlla.
 */
export async function salvaRiga(ordineId: string, rigaId: string | null, dati: unknown): Promise<Esito> {
  await utenteCorrente();
  const parsed = rigaSchema.safeParse(dati);
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error), errore: "Controlla i campi evidenziati" };

  const esito = await esegui(() =>
    rigaId ? ordini.modificaRiga(rigaId, parsed.data) : ordini.aggiungiRiga(ordineId, parsed.data),
  );
  if (esito.errore) return esito;
  aggiorna(ordineId);
  redirect(`/ordini/${ordineId}`);
}

export async function eliminaRiga(ordineId: string, rigaId: string): Promise<Esito> {
  await utenteCorrente();
  const esito = await esegui(() => ordini.eliminaRiga(rigaId));
  if (esito.errore) return esito;
  aggiorna(ordineId);
  redirect(`/ordini/${ordineId}`);
}

/** Il contatore "Quanti pezzi sono pronti?" e il bottone "Tutto pronto". */
export async function impostaQuantitaPronta(
  ordineId: string,
  rigaId: string,
  _prev: Esito,
  fd: FormData,
): Promise<Esito> {
  await utenteCorrente();
  const parsed = quantitaProntaSchema.safeParse(formDataInOggetto(fd));
  if (!parsed.success) return { errore: parsed.error.issues[0].message };
  const esito = await esegui(() => ordini.impostaQuantitaPronta(rigaId, parsed.data.quantitaPronta));
  aggiorna(ordineId);
  return esito;
}

/**
 * I bottoni "A che punto è?" della scheda prodotto: portano la riga alla fase
 * scelta. Per le fasi della bozza registrano anche la Bozza (data, chi, come),
 * così lo storico resta completo.
 */
export async function impostaFase(
  ordineId: string,
  rigaId: string,
  fase: "DA_FARE" | "BOZZA_INVIATA" | "BOZZA_CONFERMATA" | "IN_LAVORAZIONE" | "ANNULLATA",
  modalita?: "IN_SEDE" | "A_DISTANZA",
  rimetti = true, // solo per ANNULLATA: i pezzi presi dal magazzino tornano in magazzino?
): Promise<Esito> {
  const utente = await utenteCorrente();
  const esito = await esegui(async () => {
    if (fase === "BOZZA_INVIATA") await ordini.registraBozzaInviata(rigaId, utente.id);
    if (fase === "BOZZA_CONFERMATA")
      await ordini.confermaBozza(rigaId, { modalita: modalita ?? "IN_SEDE", note: null }, utente.id);
    // Le funzioni delle bozze fanno avanzare lo stato solo "in avanti": qui
    // l'utente ha scelto lui la fase, quindi la impostiamo comunque.
    await ordini.cambiaStatoRiga(rigaId, fase, utente.id, { rimetti });
  });
  aggiorna(ordineId);
  return esito;
}

// -----------------------------------------------------------------------------
// Consegne
// -----------------------------------------------------------------------------

export async function registraConsegna(ordineId: string, _prev: Esito, fd: FormData): Promise<Esito> {
  const utente = await utenteCorrente();
  // Il modulo ha un campo "q_<id della riga>" per ogni prodotto: lo trasformiamo in lista.
  const righe = [...fd.entries()]
    .filter(([k, v]) => k.startsWith("q_") && typeof v === "string" && v !== "")
    .map(([k, v]) => ({ rigaId: k.slice(2), quantita: v }));
  const parsed = consegnaSchema.safeParse({ righe, note: fd.get("note") ?? "" });
  if (!parsed.success) return { errore: parsed.error.issues[0].message };

  const esito = await esegui(() => ordini.registraConsegna(ordineId, parsed.data, utente.id));
  aggiorna(ordineId);
  return esito;
}

export async function annullaConsegna(ordineId: string, consegnaId: string): Promise<Esito> {
  await utenteCorrente();
  const esito = await esegui(() => ordini.annullaConsegna(consegnaId));
  aggiorna(ordineId);
  return esito;
}

// -----------------------------------------------------------------------------
// Pagamenti
// -----------------------------------------------------------------------------

export async function registraPagamento(ordineId: string, _prev: Esito, fd: FormData): Promise<Esito> {
  const utente = await utenteCorrente();
  const valori = formDataInOggetto(fd);
  const parsed = pagamentoSchema.safeParse(valori);
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error), valori };

  const esito = await esegui(() => ordini.registraPagamento(ordineId, parsed.data, utente.id));
  aggiorna(ordineId);
  return esito;
}

export async function annullaPagamento(ordineId: string, pagamentoId: string): Promise<Esito> {
  await utenteCorrente();
  const esito = await esegui(() => ordini.annullaPagamento(pagamentoId));
  aggiorna(ordineId);
  return esito;
}
