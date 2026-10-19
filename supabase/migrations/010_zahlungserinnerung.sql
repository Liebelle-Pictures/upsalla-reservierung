-- Automatische Zahlungserinnerung/Stornierung für unbezahlte Lena-Buchungen (Geburtstag/
-- Babywelt). Upsalla-Anfrage: Stripe-Zahlungslinks sterben nach spätestens 24h (Stripe-
-- Plattformgrenze für Checkout Sessions im mode=payment), Kunden die erst Tage später zahlen
-- wollen finden einen toten Link vor, und unbezahlte Reservierungen blockieren Loge+Slot
-- unbegrenzt lange. Neuer Ablauf (siehe /api/cron/lena-zahlungserinnerung):
--   T+0h:  Buchung, Zahlungslink 24h gültig (bereits bestehender Ablauf)
--   T+24h: falls unbezahlt — neuer frischer Link per SMS + Warnung "noch 24h, sonst storniert"
--   T+48h: falls weiterhin unbezahlt — automatische Stornierung + kurze SMS
-- Gilt NUR für von Lena erstellte Buchungen (angenommen_von = 'KI LENA') — Personal kann
-- weiterhin bewusst Reservierungen ohne Anzahlungsfrist anlegen.

alter table reservierungen add column if not exists stripe_session_id text;

-- Zeitpunkt, zu dem der AKTUELL gültige Zahlungslink erzeugt wurde — Startpunkt der 24h/48h-
-- Frist. Wird bei jeder Linkerstellung aktualisiert (Buchung, "Zahlungslink erneut senden"),
-- NICHT bei reiner Reservierungsänderung. NULL = kein von diesem Mechanismus verwalteter Link
-- (z.B. Personal-Buchung) → wird vom Cron nie angefasst.
alter table reservierungen add column if not exists zahlungslink_erstellt_am timestamptz;

-- Zeitpunkt der 24h-Erinnerungs-SMS. NULL = noch nicht erinnert. Gesetzt = Cron weiß, dass die
-- nächste Prüfung (weitere 24h später) zur Stornierung führt, falls immer noch unbezahlt.
alter table reservierungen add column if not exists zahlungserinnerung_gesendet_am timestamptz;
