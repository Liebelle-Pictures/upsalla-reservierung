-- 012: Optionales Foto pro Loge für das Online-Buchungs-Widget (/buchen/[standort]).
-- Ist bild_url gesetzt, zeigt die Logen-Karte das Foto, sonst das Themen-Symbol.
-- Nur https-Links (z. B. Supabase Storage, öffentlicher Bucket). Manuell im SQL Editor ausführen.

alter table logen add column if not exists bild_url text;

alter table logen drop constraint if exists logen_bild_url_https;
alter table logen add constraint logen_bild_url_https
  check (bild_url is null or bild_url ~ '^https://[^\s]+$');

comment on column logen.bild_url is 'Öffentliches Foto der Loge (https) für die Online-Buchung; NULL = Symbol anzeigen';
