import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    // Carica .env come fa Next.js, cosi' i test di integrazione trovano DATABASE_URL.
    setupFiles: ["./tests/setup.ts"],
    // I test di integrazione usano lo stesso database: niente file in parallelo.
    fileParallelism: false,
    // Alcuni test calcolano molti hash bcrypt (lenti di proposito): 5 secondi,
    // il limite di serie, non bastano, soprattutto sulle macchine della CI.
    testTimeout: 30_000,
  },
});
