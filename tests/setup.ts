// Eseguito da Vitest prima di ogni file di test (vedi vitest.config.ts).
// Carica il file .env come fa Next.js.
// ATTENZIONE: qui non si deve importare il database (@/comune/server): verrebbe
// creato con l'indirizzo VERO prima che sotto lo si cambi con quello di test.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// I test di integrazione scrivono e CANCELLANO dati: devono usare un database
// separato (TEST_DATABASE_URL), mai quello vero. Senza, vengono saltati.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
