-- Neue "Gruppen"-Loge für Kita-/Schul-/Vereinsbuchungen (Typ GRUPPE) — flexible Kapazität
-- wie BBQ Zelt (keine feste Obergrenze, nur belegt/frei), aber nur Montag bis Freitag
-- buchbar (KEIN Wochenende). Die genaue Uhrzeit (spätestens bis 13:30 Uhr) ist flexibel
-- und wird vom Upsalla-Team bei der Bestätigung festgelegt, deshalb kein eigener Zeitslot.
insert into logen (standort_id, name, max_kinder, tische_anzahl, ist_babywelt, kapazitaet_flexibel, verfuegbarkeit_regel)
values ('00000000-0000-0000-0000-000000000001', 'Gruppen', 150, 0, false, true, 'NUR_WOCHENTAG');
