-- Temporaeres Debug-Log fuer den Retell Inbound-Webhook, um das exakte eingehende
-- Payload bei einem echten Testanruf zu sehen (caller_phone kam trotz Fix als
-- "unbekannt" an - Verdacht: custom_sip_headers ist im Inbound-Webhook noch nicht
-- gesetzt, anders als im fertigen Call-Objekt). Nach Abschluss der Diagnose wieder
-- entfernen.
create table if not exists webhook_debug_log (
  id uuid primary key default gen_random_uuid(),
  quelle text not null,
  payload jsonb not null,
  erstellt_am timestamptz not null default now()
);

alter table webhook_debug_log enable row level security;
