-- CreateEnum
CREATE TYPE "CausaleMovimento" AS ENUM ('CARICO_INIZIALE', 'ARRIVO', 'CORREZIONE', 'LAVORAZIONE', 'RIENTRO');

-- AlterTable
ALTER TABLE "RigaOrdine" ADD COLUMN     "articoloId" TEXT;

-- CreateTable
CREATE TABLE "Articolo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "tipo" "TipoProdotto" NOT NULL DEFAULT 'ABBIGLIAMENTO',
    "note" TEXT,
    "archiviato" BOOLEAN NOT NULL DEFAULT false,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Articolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VarianteArticolo" (
    "id" TEXT NOT NULL,
    "articoloId" TEXT NOT NULL,
    "colore" TEXT NOT NULL DEFAULT '',
    "taglia" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "VarianteArticolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoMagazzino" (
    "id" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "quantita" INTEGER NOT NULL,
    "causale" "CausaleMovimento" NOT NULL,
    "rigaId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "utenteId" TEXT,

    CONSTRAINT "MovimentoMagazzino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Articolo_nome_idx" ON "Articolo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "VarianteArticolo_articoloId_colore_taglia_key" ON "VarianteArticolo"("articoloId", "colore", "taglia");

-- CreateIndex
CREATE INDEX "MovimentoMagazzino_varianteId_idx" ON "MovimentoMagazzino"("varianteId");

-- CreateIndex
CREATE INDEX "MovimentoMagazzino_rigaId_idx" ON "MovimentoMagazzino"("rigaId");

-- CreateIndex
CREATE INDEX "RigaOrdine_articoloId_idx" ON "RigaOrdine"("articoloId");

-- AddForeignKey
ALTER TABLE "RigaOrdine" ADD CONSTRAINT "RigaOrdine_articoloId_fkey" FOREIGN KEY ("articoloId") REFERENCES "Articolo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VarianteArticolo" ADD CONSTRAINT "VarianteArticolo_articoloId_fkey" FOREIGN KEY ("articoloId") REFERENCES "Articolo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoMagazzino" ADD CONSTRAINT "MovimentoMagazzino_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "VarianteArticolo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoMagazzino" ADD CONSTRAINT "MovimentoMagazzino_rigaId_fkey" FOREIGN KEY ("rigaId") REFERENCES "RigaOrdine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoMagazzino" ADD CONSTRAINT "MovimentoMagazzino_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un movimento a 0 non ha senso (non cambia niente): il codice non li crea mai.
ALTER TABLE "MovimentoMagazzino" ADD CONSTRAINT "MovimentoMagazzino_quantita_non_zero" CHECK ("quantita" <> 0);
