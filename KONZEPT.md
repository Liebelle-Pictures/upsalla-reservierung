# UPSALLA KINDERPARK — RESERVIERUNGSSYSTEM
# Kontext für Claude Code

## Projekt-Übersicht
Wir bauen ein digitales Reservierungssystem für den Upsalla Kinderpark 
Wuppertal als PWA (Progressive Web App). Das System ersetzt handschriftliche 
Formulare und integriert KI-Assistentin Lena (Retell AI via n8n Webhook).

## Tech Stack
- Framework: Next.js 14 (App Router)
- Styling: TailwindCSS
- Datenbank: Supabase (PostgreSQL + Auth + Realtime)
- Zahlungen: Stripe
- Hosting: Vercel
- SMS: Twilio
- E-Mail: Resend
- PDF: React-PDF
- Sprache: TypeScript

## Bekannte Daten Upsalla Wuppertal

### Logen (7 Stück, je 2 Tische)
1. Paw Patrol Jungs
2. Paw Patrol Mädchen
3. Marvel Spiderman
4. Anna & Elsa
5. Safari
6. Einhorn Schloss
7. Märchen Regenbogen
Sonderlogen Babywelt: Junge + Märchen (separate Buchung)

### Zeitslots
Wochentag (Mo–Fr):
- Slot 1: 15:00 – 19:00 Uhr
Wochenende / Ferien / Feiertage (Sa, So):
- Slot 1: 10:30 – 14:30 Uhr
- Slot 2: 15:00 – 19:00 Uhr

### Pakete & Preise
Paket WOCHENTAG:
- Preis: 23,00 € / Kind
- Mindestkinder: 6
- Zusatzkind: 6,50 €

Paket WOCHENENDE/FERIEN/FEIERTAGE:
- Preis: 27,00 € / Kind
- Mindestkinder: 6
- Zusatzkind: 7,50 €

### Logenkapazität
- 6–10 Kinder = 1 Tisch (halbe Loge)
- 11–20 Kinder = 2 Tische (ganze Loge)
- Maximum: 20 Kinder pro Loge

### Anzahlung & Stornierung
- Anzahlung: 20% des Gesamtbetrags (automatisch berechnet)
- Zahlung via Stripe Payment Link (direkt auf Upsalla-Konto)
- Kostenlose Stornierung: bis 7 Tage vor Event
- Krankheit: Rückerstattung gegen Attest (Upload oder vor Ort)
- Attest vor Ort: Mitarbeiter schaltet Rückerstattung manuell frei
- Attest digital: Upload → Staff prüft → gibt Rückerstattung frei

## Reservierungstypen
1. GEBURTSTAG — Hauptprodukt, Anzahlung Pflicht
2. BABYWELT_GEBURTSTAG — Spezielle Logen, gleiche Preise
3. GRUPPE — Kitas/Schulen, keine Anzahlung, Gruppenpreise
4. WILD_SIDE — Ü18 Events, selten
5. INTERN — Gesperrt durch Staff/Manager

## Farbcodierung Kalender
- GRÜN (#22C55E): Bestätigt + Anzahlung erhalten
- GELB (#EAB308): Bestätigt, Anzahlung ausstehend
- ROT (#EF4444): Storniert
- BLAU (#3B82F6): Gruppenangebot
- GRAU (#9CA3AF): Intern gesperrt

## Rollen
- MITARBEITER: CRUD Reservierungen, nur eigener Standort
- MANAGER: + Finanzdaten, Export, Standort-Einstellungen
- DIREKTOR: Alle Standorte, zentrales Dashboard, Lena-Statistik
- KI_LENA: Nur POST /api/reservierungen + GET /api/verfuegbarkeit

## API Endpoints (für Lena/n8n)
GET  /api/verfuegbarkeit?datum=YYYY-MM-DD&standort=wuppertal
POST /api/reservierungen
GET  /api/reservierungen/:id
PATCH /api/reservierungen/:id
GET  /api/standorte/verfuegbarkeit (alle 3 Standorte)

## Automatische Aktionen nach Reservierung
1. Stripe Payment Link generieren (20% Anzahlung)
2. SMS via Twilio an Kunden senden
3. E-Mail via Resend an Kunden senden
4. Status im Kalender: GELB (ausstehend)
5. Nach Stripe Webhook (Zahlung): Status → GRÜN
6. Nach 48h ohne Zahlung: Reminder SMS
7. Nach 72h ohne Zahlung: Staff-Benachrichtigung

## Tagesübersicht (Druckfunktion)
- Tägliche automatische Generierung um 07:00 Uhr
- Alle Reservierungen des Tages, chronologisch
- Format: A4 PDF, direkt druckbar
- Button: "Heute drucken" → sofortige PDF-Generierung
- Inhalt: Uhrzeit, Loge, Name, Kinder, Erwachsene, Menü, Notizen, Anzahlungsstatus

## Lena-Statistik Dashboard
Anzeige täglich/wöchentlich/monatlich:
- Anrufe entgegengenommen
- Reservierungen erstellt (Conversion Rate)
- Anzahlung erhalten (abgeschlossene Buchungen)
- Geschätzter Umsatz durch Lena
- Einsparung gegenüber verpassten Buchungen

## Multi-Location (Phase 2)
- Wuppertal: aktiv (Phase 1)
- Solingen: coming soon
- Velbert: coming soon
- Zentrale Supabase-DB mit Standort-Isolation
- Cross-Location Verfügbarkeitsprüfung für Lena

## Kundendatenbank
Felder: Name, Telefon, Email, Geburtsdatum Kind, 
Besuchsdatum, Typ, Standort, Anzahl Besuche, Gesamtumsatz,
DSGVO-Einwilligung (Pflicht)

Marketing-Automatisierung:
- 30 Tage vor Kindergeburtstag: SMS/E-Mail mit 10% Rabatt
- Newsletter-Export (nur mit Opt-in)

## UI Prinzipien
- Touch-first: Buttons min. 48x48px
- Tagesansicht = Standard-Startseite
- Kalender: Logen als Spalten, Zeitslots als Zeilen
- Sprache: Deutsch
- Tap auf freien Slot → Reservierung erstellen
- Tap auf Reservierung → Details + Bearbeiten

## Was NICHT gebaut wird (Out of Scope)
- Küchen-/Bestellsystem
- Kassen-/POS-System
- Ticketing für Tagesbesucher (bleibt Ticketbro)
- Buchhaltung

## Entwicklungsphasen
Phase 0: Setup (Google, Stripe, GitHub, Supabase, Vercel)
Phase 1: Kern (Kalender, Reservierung, Logen, Manual-Eingabe)
Phase 2: Zahlungen (Stripe + Anzahlung + Stornierung + Attest)
Phase 3: Lena API + Tagesübersicht PDF
Phase 4: Kundendatenbank + Marketing
Phase 5: Online-Widget für Website
Phase 6: Multi-Location Solingen/Velbert
