# Instrucțiuni pentru Claude Code — Upsalla Projekt

## Stack
- Next.js 14 App Router + TypeScript strict
- TailwindCSS — touch-first, buttons min. 48x48px
- Supabase — database, auth, realtime
- Stripe — plăți Anzahlung
- Twilio — SMS
- Resend — Email
- React-PDF — Tagesübersicht druckbar

## Reguli
- Scrie ÎNTOTDEAUNA TypeScript, niciodată JavaScript
- Folosește Server Components când posibil
- Comentarii și texte interfață în germană
- După fiecare funcție nouă, adaugă un test simplu
- Row Level Security (RLS) OBLIGATORIU în Supabase

## Structura
- /src/app/(dashboard)/ → interfața staff
- /src/app/api/ → endpoints pentru Lena/n8n
- /src/components/ → componente reutilizabile
- /src/lib/supabase/ → database client
- /src/lib/stripe/ → plăți
- /src/types/ → TypeScript types

## Context proiect
Citește KONZEPT.md pentru toate detaliile proiectului.
