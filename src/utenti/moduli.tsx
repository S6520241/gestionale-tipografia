"use client";

// =============================================================================
// utenti/moduli.tsx — moduli e bottoni interattivi di accesso e utenti
// =============================================================================
// Girano nel browser ("use client"). Ognuno chiama una server action di
// utenti/azioni.ts con useActionState, l'hook di React 19 che:
//   - collega il modulo alla server action (<form action={action}>);
//   - conserva l'ultimo Esito (errori da mostrare sotto i campi);
//   - dice se il server sta ancora lavorando (pending), per disattivare il bottone.

import { useActionState, useState } from "react";
import { Copy, KeyRound, Link2 } from "lucide-react";
import { Button, Campo, cn, Input } from "@/comune/componenti";
import type { Esito } from "@/comune/server";
import { accedi, cambiaLaMiaPassword, type EsitoConValore, passwordTemporanea, registrati } from "./azioni";
import { formattaCodice } from "./regole";

// -----------------------------------------------------------------------------
// Pagina /login
// -----------------------------------------------------------------------------

/** Modulo di accesso: email, password, "Entra". */
export function LoginForm() {
  const [esito, action, pending] = useActionState(accedi, {});
  return (
    <form action={action} className="grid gap-4">
      <Campo label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={esito.email} // dopo un errore l'email resta scritta
          required
          autoFocus
        />
      </Campo>
      <Campo label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Campo>
      {esito.errore && <p className="rounded-xl bg-red-50 px-4 py-3 font-medium text-destructive">{esito.errore}</p>}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Accesso..." : "Entra"}
      </Button>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Pagina /registrati
// -----------------------------------------------------------------------------

/**
 * Modulo "Crea il tuo account". "primo" = non c'è ancora nessun utente (niente
 * codice invito); "codice" = già compilato se si arriva da un link d'invito.
 */
export function RegistratiForm({ primo, codice }: { primo: boolean; codice?: string }) {
  const [esito, action, pending] = useActionState<Esito, FormData>(registrati, {});
  const e = esito.errori ?? {};
  const v = esito.valori ?? {}; // quanto scritto, se l'ultimo invio è fallito
  return (
    <form action={action} className="grid gap-4">
      {!primo && (
        <Campo
          label="Codice invito"
          htmlFor="codice"
          errore={e.codice}
          aiuto="Te lo dà un collega dalla pagina Utenti."
        >
          <Input
            id="codice"
            name="codice"
            defaultValue={v.codice ?? codice}
            placeholder="ABCD-EFGH"
            autoComplete="off"
            autoCapitalize="characters"
            className="text-center font-mono text-xl font-bold tracking-widest uppercase"
            required
            autoFocus={!codice}
          />
        </Campo>
      )}
      <Campo label="Il tuo nome" htmlFor="nome" errore={e.nome}>
        <Input id="nome" name="nome" defaultValue={v.nome} autoComplete="name" required autoFocus={primo || !!codice} />
      </Campo>
      <Campo label="Email" htmlFor="email" errore={e.email} aiuto="La userai per entrare.">
        <Input id="email" name="email" type="email" defaultValue={v.email} autoComplete="username" required />
      </Campo>
      <Campo label="Password" htmlFor="password" errore={e.password} aiuto="Almeno 8 caratteri.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Campo label="Ripeti la password" htmlFor="conferma" errore={e.conferma}>
        <Input id="conferma" name="conferma" type="password" autoComplete="new-password" required />
      </Campo>
      {esito.errore && <p className="rounded-xl bg-red-50 px-4 py-3 font-medium text-destructive">{esito.errore}</p>}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Creazione..." : "Crea account ed entra"}
      </Button>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Pagina /profilo (Il mio account)
// -----------------------------------------------------------------------------

/** Modulo "Cambia password". "temporanea" = l'utente sta usando una password data da un collega. */
export function CambioPasswordForm({ temporanea }: { temporanea: boolean }) {
  const [esito, action, pending] = useActionState<Esito, FormData>(cambiaLaMiaPassword, {});
  const e = esito.errori ?? {};
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <Campo
        label={temporanea ? "Password temporanea (quella che ti hanno dato)" : "Password attuale"}
        htmlFor="attuale"
        errore={e.attuale}
      >
        <Input id="attuale" name="attuale" type="password" autoComplete="current-password" required />
      </Campo>
      <Campo label="Nuova password" htmlFor="nuova" errore={e.nuova} aiuto="Almeno 8 caratteri.">
        <Input id="nuova" name="nuova" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Campo label="Ripeti la nuova password" htmlFor="conferma" errore={e.conferma}>
        <Input id="conferma" name="conferma" type="password" autoComplete="new-password" required />
      </Campo>
      {esito.errore && <p className="font-medium text-destructive">{esito.errore}</p>}
      <Button type="submit" size="lg" className="w-fit" disabled={pending}>
        {pending ? "Salvataggio..." : "Cambia password"}
      </Button>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Pagina /utenti
// -----------------------------------------------------------------------------

/** Copia negli appunti. Sulla rete del negozio (http) navigator.clipboard non c'è: si usa il vecchio metodo. */
async function copia(testo: string) {
  try {
    await navigator.clipboard.writeText(testo);
  } catch {
    // Vecchio metodo: un campo di testo invisibile, si seleziona e si "copia".
    const t = document.createElement("textarea");
    t.value = testo;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
}

/** Un codice invito scritto in grande, con i bottoni per copiarlo o copiare il link da mandare. */
export function CodiceInvito({ codice, grande }: { codice: string; grande?: boolean }) {
  // Quale bottone è stato appena premuto: per 2 secondi mostra "Copiato!".
  const [copiato, setCopiato] = useState<"codice" | "link" | null>(null);
  const fatto = async (cosa: "codice" | "link") => {
    // Il link apre la registrazione con il codice già scritto (es. da mandare su WhatsApp).
    const link = `${window.location.origin}/registrati?codice=${formattaCodice(codice)}`;
    await copia(cosa === "codice" ? formattaCodice(codice) : link);
    setCopiato(cosa);
    setTimeout(() => setCopiato(null), 2000);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={cn(
          "font-mono font-extrabold tracking-[0.15em] select-all",
          grande ? "rounded-xl bg-primary/10 px-4 py-2 text-3xl text-primary sm:text-4xl" : "text-xl",
        )}
      >
        {formattaCodice(codice)}
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fatto("codice")}>
          <Copy /> {copiato === "codice" ? "Copiato!" : "Copia codice"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fatto("link")}>
          <Link2 /> {copiato === "link" ? "Copiato!" : "Copia link"}
        </Button>
      </div>
    </div>
  );
}

/** "Password dimenticata": crea una password temporanea da dettare al collega e la mostra una volta. */
export function PasswordTemporanea({ utenteId, nome }: { utenteId: string; nome: string }) {
  const [esito, action, pending] = useActionState<EsitoConValore, FormData>(() => passwordTemporanea(utenteId), {});
  if (esito.valore)
    return (
      <div className="grid gap-1 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
        <span className="text-sm">Nuova password di {nome} (scrivila o dettagliela adesso, poi non si vede più):</span>
        <span className="font-mono text-2xl font-extrabold tracking-wider select-all">{esito.valore}</span>
        <span className="text-sm text-muted-foreground">
          Al prossimo accesso il programma gli chiederà di sceglierne una sua.
        </span>
      </div>
    );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Creare una password temporanea per ${nome}? Quella di adesso smetterà di funzionare.`))
          e.preventDefault();
      }}
    >
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <KeyRound /> Password dimenticata
      </Button>
      {esito.errore && <p className="text-sm text-destructive">{esito.errore}</p>}
    </form>
  );
}
