"use client";

// =============================================================================
// comune/moduli.tsx — parti interattive usate in tutto il programma
// =============================================================================
// "use client" (prima riga) vuol dire: questo codice gira anche nel BROWSER.
// Serve quando un componente usa gli "hook" di React (useState, useActionState,
// usePathname...) o reagisce ai clic. Le pagine invece girano sul server e
// mandano al browser HTML già pronto.
//
// Qui dentro:
//   - FormAzione e BottoneInvio: i piccoli moduli dei bottoni "Annulla",
//     "Archivia", "Tutto pronto"... che chiamano una server action;
//   - il menu (barra laterale sul computer, barra in basso sul telefono), che
//     deve sapere in che pagina siamo per evidenziare la voce giusta.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardList, Package, Plus, Sun, Users } from "lucide-react";
import type { Esito } from "./server";
import { Button, cn } from "./componenti";

// -----------------------------------------------------------------------------
// Moduli per le azioni piccole
// -----------------------------------------------------------------------------

/**
 * Modulo generico per le azioni piccole (cambia stato, annulla, archivia...).
 * useActionState collega il modulo alla server action e ci dà l'ultimo Esito,
 * per mostrare l'eventuale errore sotto i bottoni.
 * La server action arriva già "legata" ai suoi dati con .bind(), es.
 *   <FormAzione action={annullaOrdine.bind(null, ordine.id, true)}>
 */
export function FormAzione({
  action,
  children,
  conferma,
  className,
}: {
  action: (prev: Esito, fd: FormData) => Promise<Esito>;
  children: React.ReactNode;
  conferma?: string; // se c'è, prima di inviare chiede "Sei sicuro?" con questo testo
  className?: string;
}) {
  const [esito, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      // "contents": il <form> non crea un riquadro suo, i bottoni si dispongono come se non ci fosse.
      className={cn("contents", className)}
      onSubmit={(e) => {
        // window.confirm mostra la finestrella OK/Annulla del browser; con Annulla non si invia niente.
        if (conferma && !window.confirm(conferma)) e.preventDefault();
      }}
    >
      {children}
      {esito.errore && <p className="basis-full text-sm text-destructive">{esito.errore}</p>}
    </form>
  );
}

/**
 * Bottone di invio che si disattiva da solo mentre il modulo è in corso.
 * useFormStatus legge lo stato del <form> che lo contiene: per questo deve
 * stare in un componente figlio del modulo (e "use client").
 */
export function BottoneInvio(props: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button type="submit" {...props} disabled={pending || props.disabled} />;
}

// -----------------------------------------------------------------------------
// Menu
// -----------------------------------------------------------------------------
// Barra laterale sul computer, barra in basso sul telefono (come le app).
// Poche voci, con icona e nome: più semplice di così non si può.

const voci = [
  { href: "/", testo: "Oggi", icona: Sun },
  { href: "/ordini", testo: "Ordini", icona: ClipboardList },
  { href: "/clienti", testo: "Clienti", icona: Users },
  { href: "/magazzino", testo: "Magazzino", icona: Package },
];

/** Restituisce una funzione che dice se una voce del menu è quella della pagina aperta. */
function useAttiva() {
  const pathname = usePathname(); // l'indirizzo della pagina, es. "/ordini/abc123"
  return (href: string) =>
    // "Oggi" ("/") è attiva solo sulla home; le altre anche nelle sotto-pagine
    // (es. "/ordini/abc123"), tranne "Nuovo ordine" che ha il suo bottone.
    href === "/" ? pathname === "/" : pathname.startsWith(href) && !pathname.startsWith("/ordini/nuovo");
}

/** Menu del computer: il bottone "Nuovo ordine" e le voci una sotto l'altra. */
export function NavLaterale() {
  const attiva = useAttiva();
  return (
    <nav className="grid gap-1.5">
      <Link
        href="/ordini/nuovo"
        className="mb-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
      >
        <Plus className="size-6" /> Nuovo ordine
      </Link>
      {voci.map((v) => (
        <Link
          key={v.href}
          href={v.href}
          className={cn(
            "flex h-12 items-center gap-3 rounded-xl px-4 text-base font-semibold text-muted-foreground hover:bg-accent hover:text-foreground",
            attiva(v.href) && "bg-accent text-primary",
          )}
        >
          <v.icona className="size-5" /> {v.testo}
        </Link>
      ))}
    </nav>
  );
}

/** Menu del telefono: barra fissa in basso con le 4 voci e il "+" per un nuovo ordine. */
export function NavInBasso() {
  const attiva = useAttiva();
  return (
    // "lg:hidden": sparisce sugli schermi grandi, dove c'è il menu laterale.
    // "safe-area-inset-bottom": spazio per la barra di sistema degli iPhone.
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {voci.map((v) => (
        <Link
          key={v.href}
          href={v.href}
          className={cn(
            "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground",
            attiva(v.href) && "text-primary",
          )}
        >
          <v.icona className="size-6" /> {v.testo}
        </Link>
      ))}
      <Link
        href="/ordini/nuovo"
        className="flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-primary"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <Plus className="size-5" />
        </span>
        Nuovo
      </Link>
    </nav>
  );
}
