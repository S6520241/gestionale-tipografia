// =============================================================================
// comune/azienda.ts — nome dell'azienda mostrato nel programma
// =============================================================================
// Si imposta con NEXT_PUBLIC_NOME_AZIENDA nel file .env (es. "Tipografia Rossi").
// Il prefisso NEXT_PUBLIC_ fa si' che Next.js lo renda disponibile anche nel
// browser: viene scritto nel codice al momento della build, quindi dopo averlo
// cambiato va riavviato "npm run dev" (o rifatta la build).

const NOME_DI_SERIE = "Gestionale Tipografia";

/** Il nome usato nel titolo della scheda, nel logo e nella pagina di accesso. */
export const NOME_AZIENDA = process.env.NEXT_PUBLIC_NOME_AZIENDA?.trim() || NOME_DI_SERIE;

/** La sigla nel quadratino del logo. */
export const SIGLA_AZIENDA = sigla(NOME_AZIENDA);

/**
 * Due lettere dal nome: le iniziali delle prime due parole ("Tipografia Rossi" -> "TR"),
 * le maiuscole di una parola sola ("PrintLab" -> "PL"), altrimenti le prime due lettere.
 */
export function sigla(nome: string): string {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  if (parole.length >= 2) return (parole[0][0] + parole[1][0]).toUpperCase();
  const parola = parole[0] ?? "";
  const maiuscole = parola.match(/\p{Lu}/gu) ?? [];
  if (maiuscole.length >= 2) return maiuscole.slice(0, 2).join("");
  return parola.slice(0, 2).toUpperCase();
}
