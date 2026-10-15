// =============================================================================
// app/layout.tsx — la cornice HTML di TUTTE le pagine (anche login e registrazione)
// =============================================================================
// Struttura delle cartelle in src/app (le cartelle sono gli indirizzi delle pagine):
//   login/, registrati/       pagine prima di entrare
//   (app)/                    pagine dopo il login; le parentesi = non compare nell'URL
//     page.tsx                "/"           pagina Oggi
//     ordini/, clienti/, magazzino/, profilo/, utenti/
//   api/auth/                 indirizzi usati da Auth.js per il login
// Ogni page.tsx legge i dati (funzioni in src/<area>/database.ts) e mostra i
// componenti delle aree (src/<area>/componenti.tsx e moduli.tsx).

import type { Metadata, Viewport } from "next";
import { NOME_AZIENDA } from "@/comune/azienda";
import "./globals.css";

// Titolo della scheda del browser: "%s" viene sostituito dal titolo di ogni pagina
// (es. "Ordini · Tipografia Rossi"). Il nome viene da NEXT_PUBLIC_NOME_AZIENDA.
export const metadata: Metadata = {
  title: { default: NOME_AZIENDA, template: `%s · ${NOME_AZIENDA}` },
  description: "Ordini, clienti e scadenze",
};

// Sul telefono la pagina usa la larghezza dello schermo (senza, il telefono "rimpicciolisce" tutto).
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
