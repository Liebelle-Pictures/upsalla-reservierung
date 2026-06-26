-- Upsalla Reservierungssystem — Initiale Datenbankstruktur
-- RLS auf allen Tabellen aktiviert

-- Standorte
CREATE TABLE standorte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stadt text NOT NULL,
  aktiv boolean NOT NULL DEFAULT true,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE standorte ENABLE ROW LEVEL SECURITY;

-- Logen
CREATE TABLE logen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standort_id uuid NOT NULL REFERENCES standorte(id),
  name text NOT NULL,
  max_kinder smallint NOT NULL DEFAULT 20,
  tische_anzahl smallint NOT NULL DEFAULT 2,
  ist_babywelt boolean NOT NULL DEFAULT false,
  aktiv boolean NOT NULL DEFAULT true
);

ALTER TABLE logen ENABLE ROW LEVEL SECURITY;

-- Kunden
CREATE TABLE kunden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standort_id uuid NOT NULL REFERENCES standorte(id),
  vorname text NOT NULL,
  nachname text NOT NULL,
  telefon text NOT NULL,
  email text,
  kind_geburtstag date,
  dsgvo_einwilligung boolean NOT NULL DEFAULT false,
  newsletter_opt_in boolean NOT NULL DEFAULT false,
  anzahl_besuche integer NOT NULL DEFAULT 0,
  gesamtumsatz numeric(10,2) NOT NULL DEFAULT 0,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;

-- Reservierungen
CREATE TYPE reservierung_typ AS ENUM (
  'GEBURTSTAG', 'BABYWELT_GEBURTSTAG', 'GRUPPE', 'WILD_SIDE', 'INTERN'
);

CREATE TYPE reservierung_status AS ENUM (
  'BESTAETIGT_BEZAHLT', 'BESTAETIGT_AUSSTEHEND', 'STORNIERT',
  'GRUPPENANGEBOT', 'INTERN_GESPERRT'
);

CREATE TABLE reservierungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standort_id uuid NOT NULL REFERENCES standorte(id),
  loge_id uuid NOT NULL REFERENCES logen(id),
  kunde_id uuid NOT NULL REFERENCES kunden(id),
  typ reservierung_typ NOT NULL,
  status reservierung_status NOT NULL DEFAULT 'BESTAETIGT_AUSSTEHEND',
  datum date NOT NULL,
  zeitslot smallint NOT NULL CHECK (zeitslot IN (1, 2)),
  kinder_anzahl smallint NOT NULL,
  erwachsene_anzahl smallint NOT NULL DEFAULT 0,
  paket_preis_pro_kind numeric(8,2) NOT NULL,
  gesamtbetrag numeric(10,2) NOT NULL,
  anzahlung_betrag numeric(10,2) NOT NULL,
  stripe_payment_link text,
  stripe_payment_intent_id text,
  notizen text,
  erstellt_von uuid REFERENCES auth.users(id),
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loge_id, datum, zeitslot)
);

ALTER TABLE reservierungen ENABLE ROW LEVEL SECURITY;

-- Seed: Standort Wuppertal
INSERT INTO standorte (id, name, stadt) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Upsalla Wuppertal', 'Wuppertal');

-- Seed: 7 Logen Wuppertal
INSERT INTO logen (standort_id, name, ist_babywelt) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Paw Patrol Jungs', false),
  ('00000000-0000-0000-0000-000000000001', 'Paw Patrol Mädchen', false),
  ('00000000-0000-0000-0000-000000000001', 'Marvel Spiderman', false),
  ('00000000-0000-0000-0000-000000000001', 'Anna & Elsa', false),
  ('00000000-0000-0000-0000-000000000001', 'Safari', false),
  ('00000000-0000-0000-0000-000000000001', 'Einhorn Schloss', false),
  ('00000000-0000-0000-0000-000000000001', 'Märchen Regenbogen', false),
  ('00000000-0000-0000-0000-000000000001', 'Babywelt Junge', true),
  ('00000000-0000-0000-0000-000000000001', 'Babywelt Märchen', true);
