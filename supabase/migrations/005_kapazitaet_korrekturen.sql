-- Kapazitäts-Korrekturen laut Rückmeldung Upsalla (2026-09-03)
-- Ausführen in: Supabase Dashboard → SQL Editor

-- Runde Tische unten: max_kinder war 24, korrekt ist 20
UPDATE logen SET max_kinder = 20 WHERE name = 'Runde Tische unten';
