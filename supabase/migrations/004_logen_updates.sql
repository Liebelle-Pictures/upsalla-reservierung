-- Loge-Updates: Umbenennung, neue Logen, Angenommen-von-Feld
-- Ausführen in: Supabase Dashboard → SQL Editor

-- Dokumentiert bereits in Produktion entfernte Constraint (Doppelbelegung
-- funktioniert nachweislich — getestet am 2026-08-31). IF EXISTS macht das
-- ungefährlich, egal ob die Constraint noch da ist oder schon weg.
ALTER TABLE reservierungen DROP CONSTRAINT IF EXISTS reservierungen_loge_id_datum_zeitslot_key;

-- Umbenennung: "Märchen Regenbogen" → "Einhorn Regenbogen"
UPDATE logen SET name = 'Einhorn Regenbogen' WHERE name = 'Märchen Regenbogen';

-- Neue Spalten für Sonderlogen
ALTER TABLE logen ADD COLUMN IF NOT EXISTS kapazitaet_flexibel boolean NOT NULL DEFAULT false;
ALTER TABLE logen ADD COLUMN IF NOT EXISTS verfuegbarkeit_regel text;
-- verfuegbarkeit_regel = NULL  → normale Verfügbarkeit (alle Tage/Slots)
-- verfuegbarkeit_regel = 'SA_SO_SLOT1' → nur Samstag/Sonntag, Slot 1 (10:30–14:30)

-- Neue Logen
INSERT INTO logen (standort_id, name, max_kinder, tische_anzahl, ist_babywelt, kapazitaet_flexibel, verfuegbarkeit_regel)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'BBQ Zelt', 20, 2, false, true, NULL),
  ('00000000-0000-0000-0000-000000000001', 'Runde Tische unten', 24, 3, false, false, 'SA_SO_SLOT1');

-- Neues Feld: wer hat die Reservierung angenommen (KI Lena / Staff-Name / Import)
ALTER TABLE reservierungen ADD COLUMN IF NOT EXISTS angenommen_von text NOT NULL DEFAULT 'KI LENA';
