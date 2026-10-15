"use client";

// =============================================================================
// app/(app)/error.tsx — schermata "Qualcosa è andato storto"
// =============================================================================
// Next.js la mostra al posto della pagina quando c'è un errore imprevisto (bug,
// database spento...). Deve girare nel browser ("use client") per il bottone Riprova.
// I messaggi per l'utente (ErroreUtente) invece non arrivano qui: li mostrano i moduli.

export default function Errore({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-md gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <span className="text-5xl">😕</span>
      <h1 className="text-2xl font-bold">Qualcosa è andato storto</h1>
      <p className="text-muted-foreground">Riprova. Se succede ancora, avvisa Francesco con questo codice:</p>
      {/* digest = codice dell'errore, per ritrovarlo nei log del server */}
      <code className="rounded-lg bg-muted px-3 py-2 text-sm">{error.digest ?? error.message}</code>
      <button
        onClick={reset}
        className="mx-auto h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Riprova
      </button>
    </div>
  );
}
