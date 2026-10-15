"use server";

// =============================================================================
// magazzino/azioni.ts — server action del magazzino
// =============================================================================
// Stesso schema delle altre aree:
//   1. utente loggato  2. validazione Zod  3. database  4. aggiorna la pagina o cambia pagina.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { utenteCorrente } from "@/auth";
import { erroriPerCampo, type Esito, esegui, formDataInOggetto } from "@/comune/server";
import * as magazzino from "./database";
import { articoloSchema, movimentoSchema } from "./regole";

/** Dopo una modifica: ridisegna l'elenco del magazzino e, se c'è, la pagina dell'articolo. */
function aggiorna(id?: string | null) {
  revalidatePath("/magazzino");
  if (id) revalidatePath(`/magazzino/${id}`);
}

/** Modulo articolo: crea (id = null, poi si va alla sua pagina) o modifica. */
export async function salvaArticolo(id: string | null, _prev: Esito, fd: FormData): Promise<Esito> {
  await utenteCorrente();
  const valori = formDataInOggetto(fd);
  const parsed = articoloSchema.safeParse(valori);
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error), valori };

  let nuovoId = id;
  const esito = await esegui(async () => {
    if (id) await magazzino.aggiornaArticolo(id, parsed.data);
    else nuovoId = (await magazzino.creaArticolo(parsed.data)).id;
  });
  if (esito.errore) return { ...esito, valori };
  aggiorna(nuovoId);
  if (!id) redirect(`/magazzino/${nuovoId}`);
  return { ok: true };
}

/** tipo = "ARRIVO" (si aggiungono pezzi) o "CORREZIONE" (si scrive quanti ce ne sono davvero). */
export async function registraMovimento(
  articoloId: string,
  tipo: "ARRIVO" | "CORREZIONE",
  _prev: Esito,
  fd: FormData,
): Promise<Esito> {
  const utente = await utenteCorrente();
  const valori = formDataInOggetto(fd);
  // "+ Nuovo colore" / "+ Nuova taglia": se scelti, vale il campo scritto a mano.
  if (valori.colore === "__nuovo") valori.colore = valori.coloreNuovo ?? "";
  if (valori.taglia === "__nuovo") valori.taglia = valori.tagliaNuova ?? "";
  const parsed = movimentoSchema.safeParse(valori);
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error), valori };

  const esito = await esegui(() =>
    tipo === "ARRIVO"
      ? magazzino.registraArrivo(articoloId, parsed.data, utente.id)
      : magazzino.correggiGiacenza(articoloId, parsed.data, utente.id),
  );
  if (esito.errore) return { ...esito, valori };
  aggiorna(articoloId);
  return { ok: true };
}

/** Bottone "Archivia articolo" / "Riporta nel magazzino". */
export async function archiviaArticolo(id: string, archiviato: boolean): Promise<Esito> {
  await utenteCorrente();
  const esito = await esegui(() => magazzino.impostaArticoloArchiviato(id, archiviato));
  aggiorna(id);
  return esito;
}
