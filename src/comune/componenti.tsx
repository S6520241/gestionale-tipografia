// =============================================================================
// comune/componenti.tsx — i "mattoncini" grafici usati in tutte le pagine
// =============================================================================
// Bottoni, etichette colorate (badge), riquadri (card), campi dei moduli, avatar,
// titolo della pagina... Sono scritti a mano nello stile di shadcn/ui
// (https://ui.shadcn.com), in versione semplificata.
//
// Qui non c'è "use client": sono semplici funzioni che restituiscono HTML.
// Le può usare una pagina (che gira sul server) e anche un componente
// "use client" (in quel caso vengono disegnate nel browser).
//
// Le classi tipo "rounded-xl px-4 font-semibold" sono di Tailwind CSS:
// ognuna è una regola di stile (angoli arrotondati, spazio a destra e sinistra,
// testo in grassetto...). I colori del tema sono in src/app/globals.css.

import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NOME_AZIENDA, SIGLA_AZIENDA } from "./azienda";
import type { Esito } from "./server";

// -----------------------------------------------------------------------------
// cn(): unire le classi di Tailwind
// -----------------------------------------------------------------------------

/**
 * Unisce più classi di Tailwind risolvendo i conflitti: l'ultima vince.
 * Esempio: cn("p-2", grande && "p-4") -> "p-4" se grande è vero, "p-2" se no.
 * clsx toglie i valori falsi (false, undefined), twMerge risolve i conflitti.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// -----------------------------------------------------------------------------
// Bottoni
// -----------------------------------------------------------------------------

/**
 * Le classi di un bottone, a seconda di "variant" (il colore) e "size" (la grandezza).
 * cva ("class variance authority") costruisce la stringa di classi giusta.
 * Si usa anche da sola sui link che devono sembrare bottoni:
 *   <Link className={buttonVariants({ size: "lg" })}>...</Link>
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90", // viola pieno
        success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700", // verde: "fatto", "pagato"
        destructive: "bg-destructive text-white shadow-sm hover:bg-destructive/90", // rosso: annulla
        outline: "border-2 border-input bg-card hover:bg-accent", // bianco con bordo
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-accent", // senza sfondo, solo testo
        link: "text-primary underline-offset-4 hover:underline", // come un link
      },
      size: {
        default: "h-11 px-4 text-[15px]",
        sm: "h-9 px-3 text-sm [&_svg]:size-4",
        lg: "h-12 px-5 text-base",
        xl: "h-14 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

/** Un <button> con lo stile del programma. Accetta tutto quello che accetta un <button>. */
export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

// -----------------------------------------------------------------------------
// Badge: etichette colorate per gli stati
// -----------------------------------------------------------------------------

// Un colore per ogni significato: lo stesso colore vuol dire sempre la stessa cosa.
const coloriBadge = {
  grigio: "bg-slate-100 text-slate-700 ring-slate-200",
  blu: "bg-blue-100 text-blue-800 ring-blue-200",
  azzurro: "bg-sky-100 text-sky-800 ring-sky-200",
  viola: "bg-violet-100 text-violet-800 ring-violet-200",
  ambra: "bg-amber-100 text-amber-900 ring-amber-200",
  verde: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  rosso: "bg-red-100 text-red-800 ring-red-200",
} as const;

// Il pallino colorato a sinistra del testo.
const pallini = {
  grigio: "bg-slate-400",
  blu: "bg-blue-500",
  azzurro: "bg-sky-500",
  viola: "bg-violet-500",
  ambra: "bg-amber-500",
  verde: "bg-emerald-500",
  rosso: "bg-red-500",
} as const;

/** I colori possibili di un badge: "grigio" | "blu" | ... (ricavati dalle chiavi qui sopra). */
export type ColoreBadge = keyof typeof coloriBadge;

/** Etichetta arrotondata con pallino, es. ● Pronta. "grande" per le intestazioni. */
export function Badge({
  colore = "grigio",
  grande = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { colore?: ColoreBadge; grande?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset",
        grande ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        coloriBadge[colore],
        className,
      )}
      {...props}
    >
      <span className={cn("rounded-full", grande ? "size-2" : "size-1.5", pallini[colore])} />
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Card: riquadri bianchi con bordo
// -----------------------------------------------------------------------------

/** Il riquadro bianco con bordo e angoli arrotondati. */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border bg-card text-card-foreground shadow-[0_1px_3px_rgb(0_0_0/0.04)]", className)}
      {...props}
    />
  );
}

/** Parte alta di una Card (di solito contiene CardTitle). */
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5 sm:p-6", className)} {...props} />;
}

/** Titolo di una Card. */
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-lg font-bold leading-tight", className)} {...props} />;
}

/** Contenuto di una Card, sotto l'intestazione. */
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

// -----------------------------------------------------------------------------
// Campi dei moduli
// -----------------------------------------------------------------------------
// Grandi apposta (48px di altezza): si toccano bene anche col dito.
// Il <select> è quello del browser: sul telefono apre il selettore di sistema.

const baseCampo =
  "w-full rounded-xl border-2 border-input bg-card px-4 text-base shadow-xs placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none disabled:opacity-50";

/** Campo di testo su una riga. */
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(baseCampo, "h-12", className)} {...props} />;
}

/** Campo di testo su più righe (note). */
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(baseCampo, "min-h-24 py-3", className)} {...props} />;
}

/** Menu a tendina. */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(baseCampo, "h-12", className)} {...props} />;
}

/**
 * Etichetta + campo + eventuale aiuto o errore, uno sotto l'altro.
 * "htmlFor" deve essere uguale all'id del campo: così toccando l'etichetta
 * si attiva il campo (e i lettori di schermo sanno a cosa si riferisce).
 */
export function Campo({
  label,
  htmlFor,
  errore,
  aiuto,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  errore?: string;
  aiuto?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label className="text-[15px] font-semibold" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {/* L'aiuto si nasconde quando c'è un errore, per non riempire lo schermo. */}
      {aiuto && !errore && <p className="text-sm text-muted-foreground">{aiuto}</p>}
      {errore && <p className="text-sm font-medium text-destructive">{errore}</p>}
    </div>
  );
}

/**
 * Il fondo dei moduli "crea / salva": il bottone, poi "✓ Salvato" oppure l'errore.
 * "pending" è vero mentre il server sta salvando: il bottone si disattiva,
 * così un doppio clic non crea due volte la stessa cosa.
 */
export function PiedeModulo({ pending, testo, esito }: { pending: boolean; testo: string; esito: Esito }) {
  return (
    <div className="flex items-center gap-3 sm:col-span-2">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Salvataggio..." : testo}
      </Button>
      {esito.ok && (
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">✓ Salvato</span>
      )}
      {esito.errore && <span className="font-medium text-destructive">{esito.errore}</span>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Altri pezzi comuni
// -----------------------------------------------------------------------------

// Colori per gli avatar: scelti dal nome, così la stessa persona ha sempre lo stesso colore.
const COLORI_AVATAR = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-teal-100 text-teal-700",
];

/** Cerchio con le iniziali del nome (es. "Bar Sport" -> "BS"). */
export function Avatar({ nome, className }: { nome: string; className?: string }) {
  const iniziali = nome
    .split(/\s+/) // parole separate da spazi
    .filter(Boolean) // niente parole vuote (due spazi di fila)
    .slice(0, 2) // al massimo due parole
    .map((p) => p[0]!.toUpperCase()) // la prima lettera, maiuscola
    .join("");
  // Somma dei codici delle lettere: sempre la stessa per lo stesso nome.
  const somma = [...nome].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-bold",
        COLORI_AVATAR[somma % COLORI_AVATAR.length],
        className,
      )}
    >
      {iniziali || "?"}
    </span>
  );
}

/** Titolo grande della pagina, con sottotitolo e azioni (bottoni) a destra. */
export function TitoloPagina({
  titolo,
  sottotitolo,
  azioni,
  className,
}: {
  titolo: React.ReactNode;
  sottotitolo?: React.ReactNode;
  azioni?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="grid gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{titolo}</h1>
        {sottotitolo && <p className="text-base text-muted-foreground">{sottotitolo}</p>}
      </div>
      {azioni && <div className="flex flex-wrap gap-2">{azioni}</div>}
    </div>
  );
}

/** Sfondo colorato e riquadro bianco delle pagine fuori dal programma (accesso, registrazione). */
export function SchermataAccesso({ sottotitolo, children }: { sottotitolo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-7 shadow-2xl">
        <div className="mb-6 grid justify-items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-2xl font-extrabold text-white shadow-lg">
            {SIGLA_AZIENDA}
          </span>
          <h1 className="text-2xl font-extrabold">{NOME_AZIENDA}</h1>
          <p className="text-muted-foreground">{sottotitolo}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
