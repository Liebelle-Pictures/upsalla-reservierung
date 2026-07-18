-- Tabelle für Lena KI Anruf-Protokoll
-- Ausführen in: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS lena_anrufe (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id               TEXT        UNIQUE NOT NULL,
  datum                 DATE        NOT NULL,
  dauer_sekunden        INTEGER     DEFAULT 0,
  telefon               TEXT,
  reservierung_erstellt BOOLEAN     DEFAULT FALSE,
  anruf_erfolgreich     BOOLEAN     DEFAULT FALSE,
  in_voicemail          BOOLEAN     DEFAULT FALSE,
  zusammenfassung       TEXT,
  erstellt_am           TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Abfragen nach Datum
CREATE INDEX IF NOT EXISTS lena_anrufe_datum_idx ON lena_anrufe (datum);

-- RLS aktivieren
ALTER TABLE lena_anrufe ENABLE ROW LEVEL SECURITY;

-- Service Role darf alles (für den Webhook)
CREATE POLICY "service_role_alle_rechte" ON lena_anrufe
  FOR ALL USING (true);
