// =============================================================================
// utenti/database.ts — utenti, codici invito e password nel database
// =============================================================================
// Solo server. Le pagine e le server action (utenti/azioni.ts) chiamano queste
// funzioni; le regole senza database sono in utenti/regole.ts.
// Testate col database vero in tests/database.test.ts.
//
// Le password non si salvano mai in chiaro: si salva un "hash" fatto con bcrypt,
// una specie di impronta da cui non si può risalire alla password. Al login si
// rifà l'impronta della password scritta e si confrontano le due.

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, ErroreUtente } from "@/comune/server";
import { GIORNI_VALIDITA_INVITO, generaCodice, normalizzaCodice, type RegistrazioneInput } from "./regole";

// Quanto lavoro fa bcrypt (2^12 giri): abbastanza lento da scoraggiare chi prova
// milioni di password, abbastanza veloce (qualche decimo di secondo) per noi.
const COSTO_BCRYPT = 12;

// Hash di una password qualsiasi: se l'email non esiste si fa lo stesso un confronto,
// così la risposta impiega lo stesso tempo e non si capisce quali email sono registrate.
// Si calcola una volta sola, la prima volta che serve ("??=" assegna solo se è vuoto).
let hashFinto: Promise<string> | undefined;
const HASH_FINTO = () => (hashFinto ??= bcrypt.hash("password-che-non-esiste", COSTO_BCRYPT));

/** Password in chiaro -> hash da salvare nel database. */
const hashPassword = (password: string) => bcrypt.hash(password, COSTO_BCRYPT);

// -----------------------------------------------------------------------------
// Accesso
// -----------------------------------------------------------------------------

/** Login: l'utente se email e password sono giuste e l'utente è attivo, altrimenti null. */
export async function verificaCredenziali(email: string, password: string) {
  const utente = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Il confronto si fa SEMPRE (anche se l'utente non c'è), per il motivo spiegato sopra HASH_FINTO.
  const ok = await bcrypt.compare(password, utente?.passwordHash ?? (await HASH_FINTO()));
  if (!utente?.passwordHash || !ok || !utente.attivo) return null;
  return utente;
}

/** C'è almeno un utente? (Se no, il programma è appena installato: si crea il primo account.) */
export async function ciSonoUtenti() {
  return (await db.user.count()) > 0;
}

// -----------------------------------------------------------------------------
// Registrazione
// -----------------------------------------------------------------------------

/**
 * Crea l'account. Serve un codice invito valido (non usato, non annullato, non scaduto),
 * tranne quando non esiste ancora nessun utente.
 * Il controllo del codice viene PRIMA di quello dell'email: senza un codice valido
 * non si scopre se un'email è già registrata.
 */
export async function registra(dati: RegistrazioneInput) {
  const passwordHash = await hashPassword(dati.password);
  // $transaction: tutte le operazioni qui dentro riescono insieme o falliscono insieme.
  return db.$transaction(async (tx) => {
    // Un lucchetto di Postgres (il numero 7301 è un nome qualsiasi): due registrazioni
    // contemporanee non possono essere entrambe "il primo utente".
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301)`;
    const primo = (await tx.user.count()) === 0;

    const codice = normalizzaCodice(dati.codice);
    let invitoId: string | null = null;
    if (!primo) {
      const invito = codice
        ? await tx.codiceInvito.findFirst({
            where: { codice, usatoIl: null, annullatoIl: null, scadeIl: { gt: new Date() } },
          })
        : null;
      if (!invito) throw new ErroreUtente("Codice invito non valido o scaduto. Chiedine uno nuovo a un collega.");
      invitoId = invito.id;
    }

    if (await tx.user.findUnique({ where: { email: dati.email } }))
      throw new ErroreUtente("Esiste già un account con questa email: prova ad accedere.");

    const utente = await tx.user.create({ data: { name: dati.nome, email: dati.email, passwordHash } });
    if (invitoId) {
      // updateMany con le condizioni: se nel frattempo qualcun altro l'ha usato, non tocca niente
      // (count = 0) e l'errore annulla tutta la transazione, compreso l'utente appena creato.
      const r = await tx.codiceInvito.updateMany({
        where: { id: invitoId, usatoIl: null, annullatoIl: null },
        data: { usatoIl: new Date(), usatoDaId: utente.id },
      });
      if (r.count === 0) throw new ErroreUtente("Codice invito già usato. Chiedine uno nuovo a un collega.");
    }
    return { utente, primo };
  });
}

// -----------------------------------------------------------------------------
// Codici invito
// -----------------------------------------------------------------------------

/** Crea un codice invito nuovo, valido per GIORNI_VALIDITA_INVITO giorni. */
export async function creaCodiceInvito(creatoDaId: string) {
  const scadeIl = new Date(Date.now() + GIORNI_VALIDITA_INVITO * 24 * 60 * 60 * 1000);
  // In pratica non si ripete mai (31^8 combinazioni), ma se capita si riprova.
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const codice = generaCodice(randomInt);
    const esiste = await db.codiceInvito.findUnique({ where: { codice } });
    if (!esiste) return db.codiceInvito.create({ data: { codice, scadeIl, creatoDaId } });
  }
  throw new Error("Impossibile generare un codice invito");
}

/** Codici ancora utilizzabili, i più recenti prima. */
export async function codiciAttivi() {
  return db.codiceInvito.findMany({
    where: { usatoIl: null, annullatoIl: null, scadeIl: { gt: new Date() } },
    orderBy: { creatoIl: "desc" },
    include: { creatoDa: { select: { name: true } } }, // "include": legge anche chi l'ha creato
  });
}

/** Annulla un codice non ancora usato (uno già usato resta com'è). */
export async function annullaCodiceInvito(id: string) {
  await db.codiceInvito.updateMany({ where: { id, usatoIl: null }, data: { annullatoIl: new Date() } });
}

// -----------------------------------------------------------------------------
// Utenti e password
// -----------------------------------------------------------------------------

/** Tutti gli utenti: prima gli attivi, poi in ordine di nome. Solo i campi che servono alla pagina. */
export async function elencoUtenti() {
  return db.user.findMany({
    orderBy: [{ attivo: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, attivo: true, creatoIl: true, devoCambiarePassword: true },
  });
}

/**
 * Cambio della propria password: serve quella attuale. Fa uscire da tutti i
 * dispositivi (sessioniValideDal = adesso). Restituisce l'email, o false se la
 * password attuale è sbagliata.
 */
export async function cambiaPassword(utenteId: string, attuale: string, nuova: string) {
  const utente = await db.user.findUniqueOrThrow({ where: { id: utenteId } });
  if (!utente.passwordHash || !(await bcrypt.compare(attuale, utente.passwordHash))) return false;
  await db.user.update({
    where: { id: utenteId },
    data: { passwordHash: await hashPassword(nuova), devoCambiarePassword: false, sessioniValideDal: new Date() },
  });
  return utente.email;
}

/**
 * Password temporanea per un collega che l'ha dimenticata: gliela si detta,
 * e al primo accesso il programma gli chiede di sceglierne una sua.
 */
export async function impostaPasswordTemporanea(utenteId: string, daUtenteId: string) {
  if (utenteId === daUtenteId)
    throw new ErroreUtente("Per la tua password usa “Cambia password” nella pagina del tuo account.");
  // Minuscole: più facile da scrivere sul telefono. Es. "k7qm-2xpa".
  const password = `${generaCodice(randomInt, 4)}-${generaCodice(randomInt, 4)}`.toLowerCase();
  await db.user.update({
    where: { id: utenteId },
    data: { passwordHash: await hashPassword(password), devoCambiarePassword: true, sessioniValideDal: new Date() },
  });
  return password;
}

/** Disattivare: non entra più (e viene buttato fuori subito), ma il suo nome resta nello storico. */
export async function impostaUtenteAttivo(utenteId: string, attivo: boolean, daUtenteId: string) {
  if (utenteId === daUtenteId && !attivo) throw new ErroreUtente("Non puoi disattivare te stesso.");
  await db.user.update({
    where: { id: utenteId },
    // "..." aggiunge sessioniValideDal solo quando si disattiva.
    data: { attivo, ...(attivo ? {} : { sessioniValideDal: new Date() }) },
  });
}
