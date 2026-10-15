-- AlterTable
ALTER TABLE "utente" ADD COLUMN     "devoCambiarePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessioniValideDal" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CodiceInvito" (
    "id" TEXT NOT NULL,
    "codice" TEXT NOT NULL,
    "creatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scadeIl" TIMESTAMP(3) NOT NULL,
    "creatoDaId" TEXT NOT NULL,
    "usatoIl" TIMESTAMP(3),
    "usatoDaId" TEXT,
    "annullatoIl" TIMESTAMP(3),

    CONSTRAINT "CodiceInvito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodiceInvito_codice_key" ON "CodiceInvito"("codice");

-- CreateIndex
CREATE UNIQUE INDEX "CodiceInvito_usatoDaId_key" ON "CodiceInvito"("usatoDaId");

-- AddForeignKey
ALTER TABLE "CodiceInvito" ADD CONSTRAINT "CodiceInvito_creatoDaId_fkey" FOREIGN KEY ("creatoDaId") REFERENCES "utente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodiceInvito" ADD CONSTRAINT "CodiceInvito_usatoDaId_fkey" FOREIGN KEY ("usatoDaId") REFERENCES "utente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
