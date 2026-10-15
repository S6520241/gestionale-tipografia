// =============================================================================
// magazzino/componenti.tsx — la tabella della giacenza
// =============================================================================
// Componenti senza interazione, disegnati sul server (pagine Magazzino e Articolo).

import { cn } from "@/comune/componenti";
import { tabellaGiacenza } from "./regole";

/** Colore di un numero di pezzi: rosso = sotto zero, grigio = finiti, normale altrimenti. */
export function coloreGiacenza(n: number) {
  return n < 0 ? "bg-red-100 text-red-700" : n === 0 ? "text-muted-foreground/60" : "text-foreground";
}

/**
 * Tabella della giacenza: una riga per colore, una colonna per taglia, il totale in fondo.
 * Rosso = sotto zero (sono stati usati più pezzi di quelli segnati), grigio = finiti.
 * "compatta" = celle più piccole, per l'elenco del magazzino.
 */
export function GrigliaGiacenza({
  varianti,
  compatta,
}: {
  varianti: { colore: string; taglia: string; giacenza: number }[];
  compatta?: boolean;
}) {
  if (varianti.length === 0) return <p className="text-muted-foreground">Nessun colore o taglia ancora.</p>;
  const t = tabellaGiacenza(varianti);
  // Articolo senza taglie (es. un gadget): solo la colonna del totale.
  const soloTotale = t.taglie.length === 1 && t.taglie[0] === "";
  const cella = compatta ? "px-2 py-1" : "px-3 py-2";
  return (
    // overflow-x-auto: se le taglie sono tante, la tabella scorre di lato invece di uscire dallo schermo.
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className={cn(cella, "text-left font-semibold")}>Colore</th>
            {!soloTotale &&
              t.taglie.map((tg) => (
                <th key={tg} className={cn(cella, "text-center font-semibold whitespace-nowrap")}>
                  {tg || "—"}
                </th>
              ))}
            <th className={cn(cella, "text-right font-semibold")}>Totale</th>
          </tr>
        </thead>
        <tbody>
          {t.colori.map((c) => (
            <tr key={c} className="border-t">
              <td className={cn(cella, "font-medium whitespace-nowrap")}>{c || "—"}</td>
              {!soloTotale &&
                t.taglie.map((tg) => {
                  const n = t.valore(c, tg); // undefined = questa combinazione non esiste: cella vuota
                  return (
                    <td key={tg} className={cn(cella, "text-center", n !== undefined && coloreGiacenza(n))}>
                      {n ?? ""}
                    </td>
                  );
                })}
              <td className={cn(cella, "text-right font-bold", coloreGiacenza(t.totaleColore(c)))}>
                {t.totaleColore(c)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
