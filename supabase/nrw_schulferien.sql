-- NRW Schulferien Cache
-- Wird automatisch von der App befüllt (via ferien-api.de)
-- Kein manuelles Eingreifen nötig

CREATE TABLE IF NOT EXISTS nrw_schulferien (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  start_datum  DATE        NOT NULL,
  end_datum    DATE        NOT NULL,
  jahr         INTEGER     NOT NULL,
  geladen_am   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, start_datum)
);

CREATE INDEX IF NOT EXISTS nrw_schulferien_datum_idx ON nrw_schulferien (start_datum, end_datum);
CREATE INDEX IF NOT EXISTS nrw_schulferien_jahr_idx  ON nrw_schulferien (jahr);

-- RLS: nur der Service-Role-Client (supabaseAdmin) darf lesen/schreiben
ALTER TABLE nrw_schulferien ENABLE ROW LEVEL SECURITY;
