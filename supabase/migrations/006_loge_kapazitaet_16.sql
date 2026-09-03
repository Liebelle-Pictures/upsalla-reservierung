-- Reale Kapazität normaler Themenlogen: 16 Kinder (8 pro Tisch × 2 Tische), nicht 20.
-- Babywelt (max 20), BBQ Zelt (flexibel) und Runde Tische unten (max 20) bleiben unverändert.
-- Ausführen in: Supabase Dashboard → SQL Editor

UPDATE logen
SET max_kinder = 16
WHERE ist_babywelt = false
  AND kapazitaet_flexibel = false
  AND verfuegbarkeit_regel IS NULL;
