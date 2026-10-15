// Carica il magazzino iniziale da un file JSON.
// Uso:  npm run magazzino:importa                       (usa prisma/inventario-esempio.json)
//       npm run magazzino:importa -- percorso/file.json  (es. l'inventario reale, che non va su Git)
// Si puo' lanciare una volta sola: se nel magazzino ci sono gia' articoli si ferma,
// cosi' non si caricano i pezzi due volte.

import { readFileSync } from "node:fs";
import { PrismaClient, type TipoProdotto } from "@prisma/client";

type Voce = { colore: string; taglia: string; quantita: number };
type Riga = { nome: string; categoria: string; tipo: TipoProdotto; note?: string | null; varianti: Voce[] };

const file = process.argv[2] ?? "prisma/inventario-esempio.json";
const db = new PrismaClient();

async function main() {
  const gia = await db.articolo.count();
  if (gia > 0) {
    console.error(`Nel magazzino ci sono già ${gia} articoli: importazione non fatta (eviterei doppioni).`);
    process.exitCode = 1;
    return;
  }
  const dati: Riga[] = JSON.parse(readFileSync(file, "utf8"));
  let varianti = 0;
  let pezzi = 0;
  // Una transazione: o entra tutto o niente.
  await db.$transaction(
    async (tx) => {
      for (const a of dati) {
        await tx.articolo.create({
          data: {
            nome: a.nome,
            categoria: a.categoria,
            tipo: a.tipo,
            note: a.note ?? null,
            varianti: {
              create: a.varianti.map((v) => ({
                colore: v.colore,
                taglia: v.taglia,
                // Le quantita' a 0 creano solo la variante (il colore esiste, ma e' finito).
                movimenti:
                  v.quantita !== 0 ? { create: { quantita: v.quantita, causale: "CARICO_INIZIALE" } } : undefined,
              })),
            },
          },
        });
        varianti += a.varianti.length;
        pezzi += a.varianti.reduce((s, v) => s + v.quantita, 0);
      }
    },
    { timeout: 60_000 },
  );
  console.log(`Importati da ${file}: ${dati.length} articoli, ${varianti} varianti, ${pezzi} pezzi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
