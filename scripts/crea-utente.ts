// Crea un utente o ne cambia la password.
// Uso:  npm run utente:crea -- email@esempio.it "Nome Cognome"
// La password viene chiesta a parte, cosi' non resta nella cronologia del terminale.
// Di solito non serve: ci si registra dal programma con un codice invito (pagina Utenti).
// Resta per le emergenze, es. se nessuno ricorda piu' la password.

import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, nome, passwordDaArgomenti] = process.argv.slice(2);
const db = new PrismaClient();

async function chiediPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question("Password (almeno 8 caratteri): ");
  } finally {
    rl.close();
  }
}

async function main() {
  if (!email || !nome) {
    console.error('Uso: npm run utente:crea -- email "Nome Cognome"');
    process.exitCode = 1;
    return;
  }
  // La password come terzo argomento resta accettata (es. per script automatici).
  const password = passwordDaArgomenti ?? (await chiediPassword());
  if (password.length < 8) {
    console.error("La password deve avere almeno 8 caratteri.");
    process.exitCode = 1;
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const u = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name: nome, passwordHash, attivo: true, devoCambiarePassword: false, sessioniValideDal: new Date() },
    create: { email: email.toLowerCase(), name: nome, passwordHash },
  });
  console.log(`Utente salvato: ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
