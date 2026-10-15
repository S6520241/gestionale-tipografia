-- Toglie l'aggiornamento automatico delle pagine (contatore UltimaModifica e trigger).
-- La migrazione precedente resta, perché il database potrebbe averla già applicata.
DO $$
DECLARE
  tabella text;
BEGIN
  FOREACH tabella IN ARRAY ARRAY[
    'Cliente', 'Ordine', 'RigaOrdine', 'RigaVariante', 'Applicazione', 'Bozza',
    'StoricoStatoRiga', 'Consegna', 'ConsegnaRiga', 'Pagamento', 'Grafica',
    'VersioneGrafica', 'Articolo', 'VarianteArticolo', 'MovimentoMagazzino',
    'utente', 'CodiceInvito'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS "segna_modifica" ON %I', tabella);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS "segna_modifica"();

DROP TABLE IF EXISTS "UltimaModifica";
