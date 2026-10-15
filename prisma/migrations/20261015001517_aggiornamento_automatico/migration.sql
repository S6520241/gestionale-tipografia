-- CreateTable
CREATE TABLE "UltimaModifica" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "numero" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "UltimaModifica_pkey" PRIMARY KEY ("id")
);

-- L'unica riga del contatore.
INSERT INTO "UltimaModifica" ("id", "numero") VALUES (1, 0);

-- Aumenta il contatore UNA volta per transazione, al momento del salvataggio (COMMIT).
-- I trigger sono "deferred": il contatore si tocca solo alla fine, cosi' non blocca
-- le altre operazioni mentre una transazione e' in corso.
CREATE FUNCTION "segna_modifica"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('gestionale.modifica_segnata', true) = 'si' THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('gestionale.modifica_segnata', 'si', true); -- vale fino alla fine della transazione
  UPDATE "UltimaModifica" SET "numero" = "numero" + 1 WHERE "id" = 1;
  RETURN NULL;
END
$$;

DO $$
DECLARE
  tabella text;
BEGIN
  FOREACH tabella IN ARRAY ARRAY[
    'Cliente', 'Ordine', 'RigaOrdine', 'RigaVariante', 'Applicazione', 'Bozza', 'StoricoStatoRiga',
    'Consegna', 'ConsegnaRiga', 'Pagamento', 'Grafica', 'VersioneGrafica',
    'Articolo', 'VarianteArticolo', 'MovimentoMagazzino', 'utente', 'CodiceInvito'
  ] LOOP
    EXECUTE format(
      'CREATE CONSTRAINT TRIGGER "segna_modifica" AFTER INSERT OR UPDATE OR DELETE ON %I
         DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "segna_modifica"()',
      tabella
    );
  END LOOP;
END
$$;
