// Popola il database con il primo utente (da .env) e, se il DB e' vuoto,
// qualche dato di esempio per provare l'app.
// Uso:  npm run db:seed     (si puo' rilanciare: non duplica niente)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_EMAIL?.toLowerCase();
  const password = process.env.SEED_PASSWORD;
  const nome = process.env.SEED_NOME ?? "Amministratore";
  if (!email || !password) throw new Error("Imposta SEED_EMAIL e SEED_PASSWORD nel file .env");

  const utente = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: nome, passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Utente pronto: ${utente.email}`);

  if ((await db.cliente.count()) > 0) {
    console.log("Ci sono gia' clienti: niente dati di esempio.");
    return;
  }

  const bar = await db.cliente.create({ data: { nome: "Bar Mario (esempio)", telefono: "0123 456789" } });
  await db.cliente.create({ data: { nome: "ASD Polisportiva (esempio)", email: "info@esempio.it" } });

  // Numero ordine: stesso meccanismo del codice vero (prossimoProgressivo in src/ordini/database.ts).
  const anno = new Date().getFullYear();
  const [{ ultimo }] = await db.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO "Contatore" (anno, ultimo) VALUES (${anno}, 1)
    ON CONFLICT (anno) DO UPDATE SET ultimo = "Contatore".ultimo + 1
    RETURNING ultimo`;

  const tra5giorni = new Date();
  tra5giorni.setUTCDate(tra5giorni.getUTCDate() + 5);
  tra5giorni.setUTCHours(0, 0, 0, 0);

  await db.ordine.create({
    data: {
      anno,
      progressivo: ultimo,
      clienteId: bar.id,
      creatoDaId: utente.id,
      dataConsegna: tra5giorni,
      note: "Ordine di esempio: si puo' archiviare.",
      righe: {
        create: [
          {
            posizione: 0,
            descrizione: "Magliette cotone",
            tipo: "ABBIGLIAMENTO",
            prezzoUnitario: "8.50",
            varianti: {
              create: [
                { colore: "Nero", taglia: "M", quantita: 20 },
                { colore: "Nero", taglia: "L", quantita: 10 },
              ],
            },
            applicazioni: {
              create: [
                { tecnica: "STAMPA", posizione: "CUORE", parametri: { colori: ["Bianco"] } },
                { tecnica: "RICAMO", posizione: "SPALLE", parametri: { coloriFili: ["Oro", "Rosso"] } },
              ],
            },
          },
          {
            posizione: 1,
            descrizione: "Adesivi 10x10",
            tipo: "ADESIVI",
            varianti: { create: [{ quantita: 200 }] },
            note: "Stampa in quadricromia",
          },
        ],
      },
    },
  });
  console.log("Dati di esempio creati.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
