-- Kurzlinks für Stripe-Zahlungslinks in SMS (spart Segmente/Kosten)
create table if not exists sms_kurzlinks (
  code text primary key,
  ziel_url text not null,
  reservierung_id uuid references reservierungen(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  laeuft_ab_am timestamptz not null
);

create index if not exists sms_kurzlinks_laeuft_ab_am_idx on sms_kurzlinks (laeuft_ab_am);

alter table sms_kurzlinks enable row level security;
-- Keine Policies für anon/authenticated — Zugriff ausschließlich über den
-- Service-Role-Key (supabaseAdmin), genau wie bei den übrigen Tabellen dieses Projekts.
