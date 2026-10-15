// =============================================================================
// app/(app)/not-found.tsx — schermata "Pagina non trovata"
// =============================================================================
// Mostrata quando un indirizzo non esiste o una pagina chiama notFound()
// (es. /ordini/xyz con un ordine che non c'è).

import Link from "next/link";
import { buttonVariants } from "@/comune/componenti";

export default function NonTrovato() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <span className="text-5xl">🔍</span>
      <h1 className="text-2xl font-bold">Pagina non trovata</h1>
      <p className="text-muted-foreground">Forse l&apos;ordine o il cliente è stato eliminato.</p>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        Torna alla pagina Oggi
      </Link>
    </div>
  );
}
