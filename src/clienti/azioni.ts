"use server";

// =============================================================================
// clienti/azioni.ts — server action dei clienti
// =============================================================================
// Funzioni che girano sul server, chiamate dai moduli della pagina (vedi
// utenti/azioni.ts per cosa vuol dire "use server"). Schema fisso:
//   1. utente loggato  2. validazione Zod  3. database  4. aggiorna la pagina o cambia pagina.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { utenteCorrente } from "@/auth";
import { erroriPerCampo, type Esito, esegui, formDataInOggetto } from "@/comune/server";
import { aggiornaCliente, creaCliente, impostaClienteArchiviato } from "./database";
import { clienteSchema } from "./regole";

/**
 * Modulo cliente: crea (id = null) o modifica. Il primo argomento si "fissa" con
 * .bind() nel componente; gli altri due li passa useActionState.
 */
export async function salvaCliente(id: string | null, _prev: Esito, fd: FormData): Promise<Esito> {
  await utenteCorrente();
  const valori = formDataInOggetto(fd);
  const parsed = clienteSchema.safeParse(valori);
  if (!parsed.success) return { errori: erroriPerCampo(parsed.error), valori };

  let nuovoId = id;
  const esito = await esegui(async () => {
    if (id) await aggiornaCliente(id, parsed.data);
    else nuovoId = (await creaCliente(parsed.data)).id;
  });
  if (esito.errore) return { ...esito, valori };

  revalidatePath("/clienti"); // la lista dei clienti va ridisegnata
  // redirect FUORI da esegui(): funziona lanciando un errore speciale, che esegui() rilancerebbe comunque.
  // Se si arriva da "Nuovo ordine > + Nuovo cliente", si torna al nuovo ordine col cliente già scelto.
  if (!id) redirect(fd.get("ritorno") === "ordine" ? `/ordini/nuovo?clienteId=${nuovoId}` : `/clienti/${nuovoId}`);
  return { ok: true };
}

/** Bottone "Archivia il cliente" / "Ripristina il cliente". */
export async function archiviaCliente(id: string, archiviato: boolean): Promise<Esito> {
  await utenteCorrente();
  const esito = await esegui(() => impostaClienteArchiviato(id, archiviato));
  revalidatePath("/clienti");
  revalidatePath(`/clienti/${id}`);
  return esito;
}
