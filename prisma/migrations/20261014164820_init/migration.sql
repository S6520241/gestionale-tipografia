-- CreateEnum
CREATE TYPE "TipoProdotto" AS ENUM ('ABBIGLIAMENTO', 'ADESIVI', 'PANNELLI', 'GADGET', 'ALTRO');

-- CreateEnum
CREATE TYPE "StatoRiga" AS ENUM ('DA_FARE', 'BOZZA_INVIATA', 'BOZZA_CONFERMATA', 'IN_LAVORAZIONE', 'ANNULLATA');

-- CreateEnum
CREATE TYPE "Tecnica" AS ENUM ('STAMPA', 'RICAMO', 'ALTRO');

-- CreateEnum
CREATE TYPE "PosizioneApplicazione" AS ENUM ('CUORE', 'SPALLE', 'MANICA', 'ALTRO');

-- CreateEnum
CREATE TYPE "ModalitaConferma" AS ENUM ('IN_SEDE', 'A_DISTANZA');

-- CreateEnum
CREATE TYPE "StatoVersione" AS ENUM ('RICEVUTA', 'DA_SISTEMARE', 'PRONTA', 'APPROVATA', 'SCARTATA');

-- CreateEnum
CREATE TYPE "TipoFile" AS ENUM ('VETTORIALE', 'RASTER', 'ALTRO');

-- CreateTable
CREATE TABLE "utente" (
    "id" TEXT NOT NULL,
    "nome" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "partitaIva" TEXT,
    "codiceFiscale" TEXT,
    "note" TEXT,
    "archiviato" BOOLEAN NOT NULL DEFAULT false,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ordine" (
    "id" TEXT NOT NULL,
    "anno" INTEGER NOT NULL,
    "progressivo" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "dataRicezione" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataConsegna" DATE,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "archiviato" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "creatoDaId" TEXT NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ordine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contatore" (
    "anno" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Contatore_pkey" PRIMARY KEY ("anno")
);

-- CreateTable
CREATE TABLE "RigaOrdine" (
    "id" TEXT NOT NULL,
    "ordineId" TEXT NOT NULL,
    "posizione" INTEGER NOT NULL DEFAULT 0,
    "descrizione" TEXT NOT NULL,
    "tipo" "TipoProdotto" NOT NULL DEFAULT 'ABBIGLIAMENTO',
    "stato" "StatoRiga" NOT NULL DEFAULT 'DA_FARE',
    "quantitaPronta" INTEGER NOT NULL DEFAULT 0,
    "prezzoUnitario" DECIMAL(10,2),
    "note" TEXT,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificatoIl" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RigaOrdine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RigaVariante" (
    "id" TEXT NOT NULL,
    "rigaId" TEXT NOT NULL,
    "colore" TEXT NOT NULL DEFAULT '',
    "taglia" TEXT NOT NULL DEFAULT '',
    "quantita" INTEGER NOT NULL,

    CONSTRAINT "RigaVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicazione" (
    "id" TEXT NOT NULL,
    "rigaId" TEXT NOT NULL,
    "tecnica" "Tecnica" NOT NULL,
    "posizione" "PosizioneApplicazione",
    "versioneGraficaId" TEXT,
    "parametri" JSONB,
    "note" TEXT,

    CONSTRAINT "Applicazione_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bozza" (
    "id" TEXT NOT NULL,
    "rigaId" TEXT NOT NULL,
    "versioneGraficaId" TEXT,
    "inviataIl" TIMESTAMP(3),
    "confermataIl" TIMESTAMP(3),
    "modalita" "ModalitaConferma",
    "confermataDaId" TEXT,
    "note" TEXT,
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bozza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoricoStatoRiga" (
    "id" TEXT NOT NULL,
    "rigaId" TEXT NOT NULL,
    "da" "StatoRiga",
    "a" "StatoRiga" NOT NULL,
    "utenteId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoricoStatoRiga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consegna" (
    "id" TEXT NOT NULL,
    "ordineId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utenteId" TEXT NOT NULL,
    "annullata" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "Consegna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsegnaRiga" (
    "id" TEXT NOT NULL,
    "consegnaId" TEXT NOT NULL,
    "rigaId" TEXT NOT NULL,
    "quantita" INTEGER NOT NULL,

    CONSTRAINT "ConsegnaRiga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grafica" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "note" TEXT,
    "archiviata" BOOLEAN NOT NULL DEFAULT false,
    "creataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grafica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersioneGrafica" (
    "id" TEXT NOT NULL,
    "graficaId" TEXT NOT NULL,
    "numeroVersione" INTEGER NOT NULL,
    "stato" "StatoVersione" NOT NULL DEFAULT 'RICEVUTA',
    "tipoFile" "TipoFile" NOT NULL DEFAULT 'ALTRO',
    "nomeFile" TEXT NOT NULL,
    "mimeType" TEXT,
    "dimensioneByte" INTEGER,
    "chiaveOriginale" TEXT NOT NULL,
    "chiaveAnteprima" TEXT,
    "larghezzaPx" INTEGER,
    "altezzaPx" INTEGER,
    "dpi" INTEGER,
    "note" TEXT,
    "caricataDaId" TEXT NOT NULL,
    "caricataIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersioneGrafica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utente_email_key" ON "utente"("email");

-- CreateIndex
CREATE INDEX "Cliente_nome_idx" ON "Cliente"("nome");

-- CreateIndex
CREATE INDEX "Ordine_clienteId_idx" ON "Ordine"("clienteId");

-- CreateIndex
CREATE INDEX "Ordine_dataConsegna_idx" ON "Ordine"("dataConsegna");

-- CreateIndex
CREATE INDEX "Ordine_creatoDaId_idx" ON "Ordine"("creatoDaId");

-- CreateIndex
CREATE UNIQUE INDEX "Ordine_anno_progressivo_key" ON "Ordine"("anno", "progressivo");

-- CreateIndex
CREATE INDEX "RigaOrdine_ordineId_idx" ON "RigaOrdine"("ordineId");

-- CreateIndex
CREATE INDEX "RigaOrdine_stato_idx" ON "RigaOrdine"("stato");

-- CreateIndex
CREATE UNIQUE INDEX "RigaVariante_rigaId_colore_taglia_key" ON "RigaVariante"("rigaId", "colore", "taglia");

-- CreateIndex
CREATE INDEX "Applicazione_rigaId_idx" ON "Applicazione"("rigaId");

-- CreateIndex
CREATE INDEX "Applicazione_tecnica_idx" ON "Applicazione"("tecnica");

-- CreateIndex
CREATE INDEX "Applicazione_versioneGraficaId_idx" ON "Applicazione"("versioneGraficaId");

-- CreateIndex
CREATE INDEX "Bozza_rigaId_idx" ON "Bozza"("rigaId");

-- CreateIndex
CREATE INDEX "Bozza_versioneGraficaId_idx" ON "Bozza"("versioneGraficaId");

-- CreateIndex
CREATE INDEX "Bozza_confermataDaId_idx" ON "Bozza"("confermataDaId");

-- CreateIndex
CREATE INDEX "StoricoStatoRiga_rigaId_idx" ON "StoricoStatoRiga"("rigaId");

-- CreateIndex
CREATE INDEX "StoricoStatoRiga_utenteId_idx" ON "StoricoStatoRiga"("utenteId");

-- CreateIndex
CREATE INDEX "Consegna_ordineId_idx" ON "Consegna"("ordineId");

-- CreateIndex
CREATE INDEX "Consegna_utenteId_idx" ON "Consegna"("utenteId");

-- CreateIndex
CREATE INDEX "ConsegnaRiga_rigaId_idx" ON "ConsegnaRiga"("rigaId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsegnaRiga_consegnaId_rigaId_key" ON "ConsegnaRiga"("consegnaId", "rigaId");

-- CreateIndex
CREATE INDEX "Grafica_clienteId_idx" ON "Grafica"("clienteId");

-- CreateIndex
CREATE INDEX "VersioneGrafica_caricataDaId_idx" ON "VersioneGrafica"("caricataDaId");

-- CreateIndex
CREATE UNIQUE INDEX "VersioneGrafica_graficaId_numeroVersione_key" ON "VersioneGrafica"("graficaId", "numeroVersione");

-- AddForeignKey
ALTER TABLE "Ordine" ADD CONSTRAINT "Ordine_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ordine" ADD CONSTRAINT "Ordine_creatoDaId_fkey" FOREIGN KEY ("creatoDaId") REFERENCES "utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigaOrdine" ADD CONSTRAINT "RigaOrdine_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "Ordine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RigaVariante" ADD CONSTRAINT "RigaVariante_rigaId_fkey" FOREIGN KEY ("rigaId") REFERENCES "RigaOrdine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicazione" ADD CONSTRAINT "Applicazione_rigaId_fkey" FOREIGN KEY ("rigaId") REFERENCES "RigaOrdine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicazione" ADD CONSTRAINT "Applicazione_versioneGraficaId_fkey" FOREIGN KEY ("versioneGraficaId") REFERENCES "VersioneGrafica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bozza" ADD CONSTRAINT "Bozza_rigaId_fkey" FOREIGN KEY ("rigaId") REFERENCES "RigaOrdine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bozza" ADD CONSTRAINT "Bozza_versioneGraficaId_fkey" FOREIGN KEY ("versioneGraficaId") REFERENCES "VersioneGrafica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bozza" ADD CONSTRAINT "Bozza_confermataDaId_fkey" FOREIGN KEY ("confermataDaId") REFERENCES "utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoricoStatoRiga" ADD CONSTRAINT "StoricoStatoRiga_rigaId_fkey" FOREIGN KEY ("rigaId") REFERENCES "RigaOrdine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoricoStatoRiga" ADD CONSTRAINT "StoricoStatoRiga_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consegna" ADD CONSTRAINT "Consegna_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "Ordine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consegna" ADD CONSTRAINT "Consegna_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsegnaRiga" ADD CONSTRAINT "ConsegnaRiga_consegnaId_fkey" FOREIGN KEY ("consegnaId") REFERENCES "Consegna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsegnaRiga" ADD CONSTRAINT "ConsegnaRiga_rigaId_fkey" FOREIGN KEY ("rigaId") REFERENCES "RigaOrdine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grafica" ADD CONSTRAINT "Grafica_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersioneGrafica" ADD CONSTRAINT "VersioneGrafica_graficaId_fkey" FOREIGN KEY ("graficaId") REFERENCES "Grafica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersioneGrafica" ADD CONSTRAINT "VersioneGrafica_caricataDaId_fkey" FOREIGN KEY ("caricataDaId") REFERENCES "utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Aggiunti a mano a questa migrazione generata da Prisma.
-- Sono una rete di sicurezza: la validazione principale resta Zod.

ALTER TABLE "RigaVariante" ADD CONSTRAINT "rigavariante_quantita_positiva" CHECK (quantita > 0);
ALTER TABLE "ConsegnaRiga" ADD CONSTRAINT "consegnariga_quantita_positiva" CHECK (quantita > 0);
ALTER TABLE "RigaOrdine"   ADD CONSTRAINT "rigaordine_quantitapronta_nonneg" CHECK ("quantitaPronta" >= 0);
ALTER TABLE "RigaOrdine"   ADD CONSTRAINT "rigaordine_prezzo_nonneg" CHECK ("prezzoUnitario" IS NULL OR "prezzoUnitario" >= 0);
ALTER TABLE "Ordine"       ADD CONSTRAINT "ordine_progressivo_positivo" CHECK (progressivo > 0);
