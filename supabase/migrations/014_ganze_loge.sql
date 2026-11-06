-- „Ganze Loge reservieren“ (gegen Aufpreis) — siehe docs/module/online-buchung.md, Abschnitt 10.
-- Manuell im Supabase Dashboard → SQL Editor ausführen. Idempotent (mehrfach ausführbar).
--
-- Regel: Eine Reservierung mit ganze_loge = true belegt die Loge exklusiv, genau wie eine Gruppe
-- mit 10+ Kindern. Abgerechnet werden dann mindestens 10 Kinder (Preis rechnet der Server).
--
-- RÜCKWÄRTSKOMPATIBEL: Diese Migration läuft in Production, BEVOR der neue Code auf main ist.
--   - ganze_loge hat default false → alter Code (Lena, Personal, Widget) schreibt sie nie, alles bleibt gleich.
--   - p_ganze_loge hat default false → der alte Aufruf von reserviere_online (13 Parameter, ohne
--     p_ganze_loge) funktioniert nach drop + create unverändert.
--   - drop + create in EINER Transaktion: es gibt keinen Moment, in dem die Funktion fehlt.
--     (create or replace mit zusätzlichem Parameter würde eine zweite Überladung anlegen →
--     der alte Aufruf wäre mehrdeutig.)

begin;

alter table reservierungen add column if not exists ganze_loge boolean not null default false;

drop function if exists reserviere_online(uuid, uuid, uuid, date, integer, integer, integer, numeric, numeric, numeric, text, uuid, integer);
drop function if exists reserviere_online(uuid, uuid, uuid, date, integer, integer, integer, numeric, numeric, numeric, text, uuid, integer, boolean);

-- Wie Migration 011, zusätzlich:
--   - bestehende Reservierung mit ganze_loge im Slot → Loge belegt (wie 10+ Kinder)
--   - p_ganze_loge = true nur, wenn der Slot komplett leer ist
--   - p_ganze_loge wird ignoriert (false gespeichert) bei 10+ Kindern oder flexibler Loge (BBQ Zelt),
--     dort gehört die Loge der Gruppe ohnehin allein
create function reserviere_online(
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
  p_hold_minuten integer,
  p_ganze_loge boolean default false
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
  v_ganz_belegt boolean;
  v_ganze_loge boolean;
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

  -- Ganze Loge nur bei 1–9 Kindern und fester Loge sinnvoll, sonst ignorieren
  v_ganze_loge := coalesce(p_ganze_loge, false) and not v_loge.kapazitaet_flexibel and p_kinder_anzahl < 10;

  select count(*),
         coalesce(sum(kinder_anzahl), 0),
         coalesce(max(kinder_anzahl), 0),
         coalesce(bool_or(status = 'INTERN_GESPERRT'), false),
         coalesce(bool_or(ganze_loge), false)
    into v_anzahl, v_kinder, v_erste_gruppe, v_intern, v_ganz_belegt
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
      -- Gruppe mit 10+ Kindern oder „ganze Loge“ belegt die Loge exklusiv
      if v_erste_gruppe >= 10 or v_ganz_belegt then
        return jsonb_build_object('fehler', 'SLOT_BELEGT', 'hinweis', 'Diese Loge ist zu dieser Zeit leider schon vergeben. Wählt bitte eine andere Loge oder einen anderen Termin.');
      end if;
      -- Ganze Loge gewünscht, aber am Nachbartisch ist schon eine Gruppe
      if v_ganze_loge then
        return jsonb_build_object('fehler', 'SLOT_BELEGT', 'hinweis', 'Die ganze Loge ist zu dieser Zeit nicht mehr frei – am Nachbartisch feiert schon eine Gruppe. Euren eigenen Tisch könnt ihr trotzdem buchen.');
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
      notizen, angenommen_von, erstellt_von, online_hold_bis, idempotenz_schluessel, ganze_loge
    ) values (
      p_standort_id, p_loge_id, p_kunde_id,
      (case when v_loge.ist_babywelt then 'BABYWELT_GEBURTSTAG' else 'GEBURTSTAG' end)::reservierung_typ,
      'BESTAETIGT_AUSSTEHEND', p_datum, p_zeitslot,
      p_kinder_anzahl, p_erwachsene_anzahl, p_paket_preis_pro_kind, p_gesamtbetrag, p_anzahlung_betrag,
      p_notizen, 'ONLINE', null, now() + make_interval(mins => p_hold_minuten), p_idempotenz_schluessel, v_ganze_loge
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
revoke all on function reserviere_online(uuid, uuid, uuid, date, integer, integer, integer, numeric, numeric, numeric, text, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function reserviere_online(uuid, uuid, uuid, date, integer, integer, integer, numeric, numeric, numeric, text, uuid, integer, boolean) to service_role;

commit;

-- PostgREST (supabase.rpc) soll die neue Signatur sofort kennen
notify pgrst, 'reload schema';

-- Kontrolle: genau EINE Zeile, Argumente enden mit „p_ganze_loge boolean DEFAULT false“
select p.oid::regprocedure as signatur, pg_get_function_arguments(p.oid) as argumente
  from pg_proc p where p.proname = 'reserviere_online';
