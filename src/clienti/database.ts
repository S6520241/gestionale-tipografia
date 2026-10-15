// =============================================================================
// clienti/database.ts — letture e scritture dei clienti nel database
// =============================================================================
// Solo server. Ogni funzione è una query di Prisma: db.cliente.findMany(...)
// diventa una SELECT, db.cliente.create(...) una INSERT, e così via.

import { db } from "@/comune/server";
import type { ClienteInput } from "./regole";

/** Elenco per la pagina Clienti, con la ricerca e il numero di ordini di ognuno. */
export async function elencoClienti(opzioni: { cerca?: string; archiviati?: boolean } = {}) {
  const cerca = opzioni.cerca?.trim();
  return db.cliente.findMany({
    where: {
      archiviato: opzioni.archiviati ?? false,
      // Con una ricerca: il testo deve stare nel nome, nel telefono o nell'email
      // ("insensitive" = senza badare a maiuscole e minuscole).
      ...(cerca
        ? {
            OR: [
              { nome: { contains: cerca, mode: "insensitive" } },
              { telefono: { contains: cerca } },
              { email: { contains: cerca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: { _count: { select: { ordini: true } } }, // _count: quanti ordini ha, senza leggerli tutti
  });
}

/** Per i menu a tendina: solo clienti attivi, solo i campi che servono. */
export async function clientiPerSelect() {
  return db.cliente.findMany({
    where: { archiviato: false },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

/** Un cliente, o null se non esiste. */
export async function leggiCliente(id: string) {
  return db.cliente.findUnique({ where: { id } });
}

export async function creaCliente(dati: ClienteInput) {
  return db.cliente.create({ data: dati });
}

export async function aggiornaCliente(id: string, dati: ClienteInput) {
  return db.cliente.update({ where: { id }, data: dati });
}

/** Archiviare (soft delete): il cliente sparisce dalle liste ma i suoi ordini restano integri. */
export async function impostaClienteArchiviato(id: string, archiviato: boolean) {
  return db.cliente.update({ where: { id }, data: { archiviato } });
}
