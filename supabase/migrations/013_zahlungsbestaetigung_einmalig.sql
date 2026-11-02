-- 013: Zahlungsbestätigung (SMS/E-Mail) für Lena-/Personal-Zahlungen nur noch einmal.
-- Der Code (src/lib/stripe/zahlungsbestaetigung.ts) beansprucht die Bestätigung über
-- reservierungen.bestaetigung_gesendet_am (Spalte aus Migration 011, bisher nur Online-Buchungen).
--
-- Alle bereits bezahlten Reservierungen gelten als bestätigt — sonst könnte ein verspätet
-- zugestellter Stripe-Webhook (nach dem Wiedereinschalten des Endpoints) oder ein erneut
-- geöffneter /zahlung/erfolg-Link für eine ALTE Zahlung noch einmal SMS/E-Mail senden.
--
-- Manuell im Supabase Dashboard → SQL Editor ausführen, VOR dem Deploy des neuen Codes und
-- VOR dem Wiedereinschalten des Webhook-Endpoints. Idempotent (mehrfach ausführbar).
-- Mit dem alten Code kompatibel (der alte Code liest die Spalte nur bei Online-Buchungen).

update reservierungen
set bestaetigung_gesendet_am = coalesce(aktualisiert_am, erstellt_am, now())
where status = 'BESTAETIGT_BEZAHLT'
  and bestaetigung_gesendet_am is null;

-- Kontrolle: muss 0 ergeben
select count(*) as bezahlt_ohne_bestaetigung
from reservierungen
where status = 'BESTAETIGT_BEZAHLT' and bestaetigung_gesendet_am is null;
