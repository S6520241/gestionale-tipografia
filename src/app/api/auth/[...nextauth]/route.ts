// Indirizzi /api/auth/... usati da Auth.js (sessione, uscita...). Tutta la configurazione è in src/auth.ts.
// "[...nextauth]" = questa cartella risponde a qualsiasi indirizzo che inizia con /api/auth/.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
