-- Online-Buchung (öffentliches Widget /buchen/[standort]) — siehe docs/module/online-buchung.md
-- Manuell im Supabase Dashboard → SQL Editor ausführen. Idempotent (mehrfach ausführbar).

-- Standort-Slug für öffentliche URL + Schalter (Default AUS — Go-live erst in Phase 7)
alter table standorte add column if not exists slug text unique;
alter table standorte add column if not exists online_buchung_aktiv boolean not null default false;
update standorte set slug = 'upsalla' where id = '00000000-0000-0000-0000-000000000001';

-- Pro Loge online buchbar? (Gruppen: nein — noch nicht mit Upsalla geklärt)
alter table logen add column if not exists online_buchbar boolean not null default true;
update logen set online_buchbar = false where name = 'Gruppen';

-- Online-Hold: bis wann blockiert eine unbezahlte Online-Buchung den Slot
alter table reservierungen add column if not exists online_hold_bis timestamptz;
-- Schutz gegen doppeltes Absenden (Client generiert UUID pro Wizard-Durchlauf)
alter table reservierungen add column if not exists idempotenz_schluessel uuid unique;
-- Idempotenz der Bestätigung (SMS/E-Mail nur einmal)
alter table reservierungen add column if not exists bestaetigung_gesendet_am timestamptz;

-- Belegungsabfragen pro Loge/Datum/Slot (seit Migration 004 gibt es dafür keinen UNIQUE-Index mehr)
create index if not exists reservierungen_loge_datum_slot_idx on reservierungen (loge_id, datum, zeitslot);

-- Rate-Limit-Protokoll (nur gehashte IP, DSGVO)
create table if not exists online_buchung_versuche (
  id bigserial primary key,
  ip_hash text not null,
  erstellt_am timestamptz not null default now()
);
create index if not exists online_buchung_versuche_idx on online_buchung_versuche (ip_hash, erstellt_am desc);
alter table online_buchung_versuche enable row level security;  -- keine Policies = nur service_role

-- Atomare Online-Reservierung. Schützt per Advisory-Lock pro Loge/Datum/Slot gegen parallele
-- Buchungen (read-then-insert in TypeScript wäre nicht sicher). Kapazitätsregeln wie bei Lena
-- (api/lena/reservierungen), max_kinder kommt immer aus der DB.
-- Abweichungen von Lena (bewusst, nur online):
--   - typ wird aus logen.ist_babywelt abgeleitet, nicht vom Aufrufer übernommen
--   - INTERN_GESPERRT im Slot blockiert die Loge komplett, unabhängig von der Kinderzahl
-- Abgelaufene, unbezahlte Online-Holds zählen nicht als belegt. Sie werden hier NICHT storniert
-- (ohne Stripe wissen wir nicht sicher, dass nicht bezahlt wurde) — das macht der Webhook
-- checkout.session.expired bzw. die Seite /buchen/[standort]/abgebrochen.
create or replace function reserviere_online(
  p_standort_id uuid,
  p_loge_id uuid,
  p_kunde_id uuid,
  p_datum date,
  p_zeitslot integer,
  p_kinder_anzahl integer,
  p_erwachsene_anzahl integer,
  p_paket_preis_pro_kind numeric,
  p_gesamtbetrag numeric,
  p_anzahlung_betrag numeric,
  p_notizen text,
  p_idempotenz_schluessel uuid,
  p_hold_minuten integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loge record;
  v_bestehend record;
  v_anzahl integer;
  v_kinder integer;
  v_erste_gruppe integer;
  v_intern boolean;
  v_id uuid;
begin
  if p_kinder_anzahl is null or p_kinder_anzahl < 1
     or p_erwachsene_anzahl is null or p_erwachsene_anzahl < 0
     or p_zeitslot not in (1, 2)
     or p_hold_minuten is null or p_hold_minuten < 1 or p_hold_minuten > 120
     or p_idempotenz_schluessel is null then
    return jsonb_build_object('fehler', 'EINGABE_UNGUELTIG', 'hinweis', 'Ungültige Buchungsdaten.');
  end if;

  -- Sperre bis Transaktionsende: alle Online-Buchungen auf diesen Slot laufen nacheinander
  perform pg_advisory_xact_lock(hashtext(p_loge_id::text || '|' || p_datum::text || '|' || p_zeitslot::text));

  -- Doppeltes Absenden: bestehende Reservierung zurückgeben statt Fehler
  select id, status into v_bestehend from reservierungen where idempotenz_schluessel = p_idempotenz_schluessel;
  if found then
    return jsonb_build_object('id', v_bestehend.id, 'wiederholt', true, 'status', v_bestehend.status);
  end if;

  select id, standort_id, max_kinder, ist_babywelt, kapazitaet_flexibel, aktiv, online_buchbar
    into v_loge from logen where id = p_loge_id;
  if not found or not v_loge.aktiv or not v_loge.online_buchbar or v_loge.standort_id <> p_standort_id then
    return jsonb_build_object('fehler', 'LOGE_UNGUELTIG', 'hinweis', 'Diese Loge kann online nicht gebucht werden.');
  end if;

  select count(*),
         coalesce(sum(kinder_anzahl), 0),
         coalesce(max(kinder_anzahl), 0),
         coalesce(bool_or(status = 'INTERN_GESPERRT'), false)
    into v_anzahl, v_kinder, v_erste_gruppe, v_intern
    from reservierungen
   where loge_id = p_loge_id
     and datum = p_datum
     and zeitslot = p_zeitslot
     and status <> 'STORNIERT'
     and not (angenommen_von = 'ONLINE'
              and status = 'BESTAETIGT_AUSSTEHEND'
              and online_hold_bis is not null
              and online_hold_bis < now());

  if v_intern then
    return jsonb_build_object('fehler', 'SLOT_BELEGT', 'hinweis', 'Diese Loge ist zu dieser Zeit leider schon vergeben. Wählt bitte eine andere Loge oder einen anderen Termin.');
  end if;

  if v_loge.kapazitaet_flexibel then
    -- z.B. BBQ Zelt: nur eine Gruppe gleichzeitig, online auf max_kinder begrenzt
    if v_anzahl >= 1 then
      return jsonb_build_object('fehler', 'SLOT_BELEGT', 'hinweis', 'Diese Loge ist zu dieser Zeit leider schon vergeben. Wählt bitte eine andere Loge oder einen anderen Termin.');
    end if;
    if p_kinder_anzahl > v_loge.max_kinder then
      return jsonb_build_object('fehler', 'KAPAZITAET', 'hinweis', format('In diese Loge passen maximal %s Kinder.', v_loge.max_kinder));
    end if;
  else
    if v_anzahl >= 2 then
      return jsonb_build_object('fehler', 'SLOT_BELEGT', 'hinweis', 'Diese Loge ist zu dieser Zeit leider schon vergeben. Wählt bitte eine andere Loge oder einen anderen Termin.');
    end if;
    if v_anzahl = 1 then
      -- Gruppe mit 10+ Kindern belegt die Loge exklusiv
      if v_erste_gruppe >= 10 then
        return jsonb_build_object('fehler', 'SLOT_BELEGT', 'hinweis', 'Diese Loge ist zu dieser Zeit leider schon vergeben. Wählt bitte eine andere Loge oder einen anderen Termin.');
      end if;
      if p_kinder_anzahl >= 10 then
        return jsonb_build_object('fehler', 'KAPAZITAET', 'hinweis', 'In dieser Loge feiert zu dieser Zeit schon eine andere Gruppe. Mit euch zusammen sind maximal 9 Kinder möglich.');
      end if;
      if v_kinder + p_kinder_anzahl > v_loge.max_kinder then
        return jsonb_build_object('fehler', 'KAPAZITAET', 'hinweis', format('In dieser Loge sind zu dieser Zeit nur noch %s Plätze frei.', greatest(v_loge.max_kinder - v_kinder, 0)));
      end if;
    elsif p_kinder_anzahl > v_loge.max_kinder then
      return jsonb_build_object('fehler', 'KAPAZITAET', 'hinweis', format('In diese Loge passen maximal %s Kinder.', v_loge.max_kinder));
    end if;
  end if;

  begin
    insert into reservierungen (
      standort_id, loge_id, kunde_id, typ, status, datum, zeitslot,
      kinder_anzahl, erwachsene_anzahl, paket_preis_pro_kind, gesamtbetrag, anzahlung_betrag,
      notizen, angenommen_von, erstellt_von, online_hold_bis, idempotenz_schluessel
    ) values (
      p_standort_id, p_loge_id, p_kunde_id,
      (case when v_loge.ist_babywelt then 'BABYWELT_GEBURTSTAG' else 'GEBURTSTAG' end)::reservierung_typ,
      'BESTAETIGT_AUSSTEHEND', p_datum, p_zeitslot,
      p_kinder_anzahl, p_erwachsene_anzahl, p_paket_preis_pro_kind, p_gesamtbetrag, p_anzahlung_betrag,
      p_notizen, 'ONLINE', null, now() + make_interval(mins => p_hold_minuten), p_idempotenz_schluessel
    )
    returning id into v_id;
  exception when unique_violation then
    -- Gleicher Schlüssel parallel auf einem ANDEREN Slot abgeschickt (anderer Lock) → bestehende zurückgeben
    select id, status into v_bestehend from reservierungen where idempotenz_schluessel = p_idempotenz_schluessel;
    return jsonb_build_object('id', v_bestehend.id, 'wiederholt', true, 'status', v_bestehend.status);
  end;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Nur serverseitig (supabaseAdmin / service_role) aufrufbar, nie aus dem Browser
revoke all on function reserviere_online(uuid, uuid, uuid, date, integer, integer, integer, numeric, numeric, numeric, text, uuid, integer) from public, anon, authenticated;
grant execute on function reserviere_online(uuid, uuid, uuid, date, integer, integer, integer, numeric, numeric, numeric, text, uuid, integer) to service_role;
