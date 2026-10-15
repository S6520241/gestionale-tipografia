// Crea il database dei test (TEST_DATABASE_URL) se manca e applica le migrazioni.
// Non cancella niente: sono i test stessi a svuotare le tabelle (svuotaDb in tests/database.test.ts).
// Uso:  npm run test:db
// Funziona uguale su Windows, macOS e Linux (niente "VAR=... comando").

import { execSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Manca TEST_DATABASE_URL nel file .env");
  process.exit(1);
}
if (url === process.env.DATABASE_URL) {
  console.error("TEST_DATABASE_URL deve essere diverso da DATABASE_URL: i test svuotano le tabelle!");
  process.exit(1);
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
