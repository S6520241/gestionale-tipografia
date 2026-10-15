# Guida all'installazione e all'uso

Questa guida è per chi installa e usa il gestionale su un PC del negozio.
Per una panoramica del progetto vedi il [README](../README.md).

## Cosa serve sul PC

1. **Node.js 22 LTS** (almeno 20.9): <https://nodejs.org>. Controlla con `node -v`.
2. **Docker Desktop**, per il database PostgreSQL: <https://www.docker.com/products/docker-desktop>. Deve essere avviato.
3. Un terminale aperto **nella cartella del progetto** (quella con `package.json`).

Su Windows, se PowerShell blocca i comandi `npm` ("l'esecuzione di script è disabilitata"), usa il Prompt dei
comandi (`cmd`) oppure lancia una volta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Primo avvio, passo per passo

```bash
# 1. Installa le dipendenze (la prima volta ci vuole qualche minuto)
npm install

# 2. Crea il file .env partendo dal modello
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
```

Apri `.env` e cambia:

- `AUTH_SECRET`: lancia `npx auth secret`, che crea un file `.env.local` con una chiave casuale (Next.js lo legge
  e ha la precedenza su `.env`). In alternativa scrivi in `.env` una qualsiasi stringa casuale lunga.
- `NEXT_PUBLIC_NOME_AZIENDA`: il nome mostrato nel titolo, nel logo e nella pagina di accesso. Se lo cambi,
  riavvia `npm run dev`. Se manca, compare "Gestionale Tipografia".
- `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NOME`: il primo utente (solo se usi il passo 5).

```bash
# 3. Avvia PostgreSQL in Docker (resta acceso in background)
docker compose up -d

# 4. Crea le tabelle nel database (applica prisma/migrations)
npx prisma migrate deploy

# 5. (Facoltativo) Crea il primo utente e qualche dato di esempio
npm run db:seed

# 6. (Facoltativo) Carica il magazzino iniziale
npm run magazzino:importa                          # articoli di esempio
npm run magazzino:importa -- percorso/inventario.json  # il tuo inventario

# 7. Avvia il programma
npm run dev
```

Apri <http://localhost:3000>. Se non hai fatto il passo 5, il programma ti fa creare il primo account.

### Formato del file di inventario

Un array JSON di articoli, come `prisma/inventario-esempio.json`:

```json
[
  {
    "nome": "T-shirt cotone uomo",
    "categoria": "T-shirt e polo",
    "tipo": "ABBIGLIAMENTO",
    "note": null,
    "varianti": [{ "colore": "Nero", "taglia": "M", "quantita": 20 }]
  }
]
```

`tipo` è uno tra `ABBIGLIAMENTO`, `ADESIVI`, `PANNELLI`, `GADGET`, `ALTRO`. Per gli articoli senza taglia o colore
si usa la stringa vuota `""`. L'inventario reale dell'azienda tienilo fuori dal repository (il nome
`prisma/inventario-iniziale.json` è già in `.gitignore`).

## Uso di tutti i giorni

```bash
docker compose up -d   # se il database non è già acceso
npm run dev            # http://localhost:3000
```

**Dal telefono**, sulla stessa rete Wi-Fi: `npm run dev -- -H 0.0.0.0`, poi sul telefono apri
`http://<IP-del-PC>:3000`. L'IP giusto è l'"Indirizzo IPv4" della scheda Wi-Fi che mostra `ipconfig`
(non quello che inizia con 172, che è la rete virtuale di Docker).

## Utenti

- Il **primo account** si crea dal programma, alla prima apertura.
- Gli altri entrano con un **codice invito**: pagina _Utenti e inviti_ → "Crea codice invito".
  Il codice vale per una persona e scade dopo 7 giorni.
- **Password dimenticata**: un collega, dalla pagina Utenti, dà una password temporanea;
  al primo accesso bisogna sceglierne una nuova.
- Per le emergenze (es. nessuno ricorda la password):
  `npm run utente:crea -- mario@esempio.it "Mario Rossi"` (la password viene chiesta subito dopo;
  su un'email che esiste già cambia nome e password).

## Problemi comuni

- **`Can't reach database server at 127.0.0.1:5432`**: Docker non è avviato, o manca `docker compose up -d`.
- **Test o pagine lenti, `Unable to start a transaction in the given time`**: in `DATABASE_URL` e
  `TEST_DATABASE_URL` usa `127.0.0.1` e non `localhost`. Su Windows `localhost` prova prima l'indirizzo IPv6, dove il
  database non ascolta, e ogni nuova connessione perde circa 2 secondi.
- **La porta 5432 è già occupata**: c'è già un PostgreSQL installato. Fermalo, oppure in `docker-compose.yml`
  usa `"127.0.0.1:5433:5432"` e metti `5433` in `DATABASE_URL`.
- **`MissingSecret` / errore di login**: manca `AUTH_SECRET` in `.env` (o in `.env.local`).
- **Dopo aver cambiato `schema.prisma` i tipi non tornano**: `npx prisma generate` (lo fa già `npm run db:migrate`).
- **Errori strani dopo aver spostato o cancellato file**: ferma `npm run dev`, cancella la cartella `.next` e riavvia.
- **Il telefono non apre la pagina**: usa l'IPv4 della scheda Wi-Fi (vedi sopra) e permetti la porta 3000
  nel firewall di Windows.
