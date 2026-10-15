-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('ACCONTO', 'SALDO');

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "ordineId" TEXT NOT NULL,
    "tipo" "TipoPagamento" NOT NULL,
    "importo" DECIMAL(10,2),
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "utenteId" TEXT NOT NULL,
    "annullato" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pagamento_ordineId_idx" ON "Pagamento"("ordineId");

-- CreateIndex
CREATE INDEX "Pagamento_utenteId_idx" ON "Pagamento"("utenteId");

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_ordineId_fkey" FOREIGN KEY ("ordineId") REFERENCES "Ordine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Controlli che Prisma non sa scrivere nello schema (come in init):
-- un importo, se c'e', e' positivo; un acconto ha sempre l'importo.
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_importo_positivo" CHECK ("importo" IS NULL OR "importo" > 0);
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_acconto_con_importo" CHECK ("tipo" <> 'ACCONTO' OR "importo" IS NOT NULL);
