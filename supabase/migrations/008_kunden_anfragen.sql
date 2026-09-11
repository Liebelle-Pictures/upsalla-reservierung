-- Sonderanfragen von Kunden, die Lena nicht direkt lösen konnte (z.B. Sonderwünsche,
-- Beschwerden, Fragen die nicht im Wissen stehen). Vorher sagte Lena nur "ich notiere das
-- für das Team", ohne dass irgendwo tatsächlich etwas ankam — dieses Table + die
-- Staff-Ansicht in Freizo schließt die Lücke.
create table if not exists kunden_anfragen (
  id uuid primary key default gen_random_uuid(),
  vorname text,
  nachname text,
  telefon text,
  anliegen text not null,
  reservierung_id uuid references reservierungen(id) on delete set null,
  status text not null default 'OFFEN' check (status in ('OFFEN', 'ERLEDIGT')),
  erstellt_am timestamptz not null default now(),
  erledigt_am timestamptz
);

create index if not exists kunden_anfragen_status_idx on kunden_anfragen (status, erstellt_am desc);

alter table kunden_anfragen enable row level security;

-- Personal (eingeloggte Nutzer) darf lesen und den Status aktualisieren — Zugriff für
-- Lena/API läuft wie überall über den Service-Role-Key (supabaseAdmin), nicht über RLS.
CREATE POLICY "Eingeloggte können Anfragen lesen"
  ON kunden_anfragen FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Eingeloggte können Anfragen aktualisieren"
  ON kunden_anfragen FOR UPDATE
  TO authenticated
  USING (true);
