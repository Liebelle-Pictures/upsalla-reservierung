# Modul: Online-Buchung (widget public de rezervare)

> Concept pentru Claude Code. Citește tot documentul înainte de prima linie de cod.
> Lucrează **o singură fază pe sesiune**, în ordine. La finalul fiecărei faze: `npm run build`
> fără erori → commit → bifează faza în secțiunea „Status” de la final.

## 0. Ce construim

O pagină publică, fără login: **`freizo.app/buchen/upsalla`**. Părinții o deschid de pe
upsalla-kinderpark.de (buton „Jetzt online buchen”), aleg data, slotul și loja, introduc
datele de contact și plătesc **Anzahlung 20%** prin Stripe Checkout. Rezervarea apare imediat
în calendarul Freizo (GELB), iar după plată devine GRÜN.

**Ce NU construim:**
- Alegerea meniului (se face la fața locului, în park)
- Rezervări de grup (`Gruppen`), încă neclarificate cu Upsalla, deci online dezactivate
- Cont sau login pentru clienți
- Modificare/anulare online de către client (rămâne prin telefon/Lena/staff)

## 1. Reguli obligatorii pentru acest repo

- **Next.js 16.2.9**, nu 14. Înainte de orice cod nou citește ghidul relevant din
  `node_modules/next/dist/docs/` (vezi `AGENTS.md`). Middleware-ul se numește `src/proxy.ts`.
- Textele din interfață și comentariile în **germană**. Clientul e tutuit la plural, ca Lena:
  „ihr/euch”.
- Accesul la DB din rutele publice se face **exclusiv server-side** prin `supabaseAdmin`
  (service role). Niciun acces anon/RLS din browser.
- Migrațiile SQL **nu** se rulează din terminal. Scrii fișierul în `supabase/migrations/`,
  iar Valeriu îl rulează manual în Supabase Dashboard → SQL Editor. Oprește-te și spune-i
  când e nevoie.
- Nu strica fluxurile existente (Lena, staff, cron-uri). Orice schimbare în cod comun
  (Stripe, webhook, disponibilitate) trebuie să păstreze comportamentul actual pentru Lena și staff.
- SMS-uri: doar caractere GSM-7 (fără „–” „—”, vezi comentariile existente), linkuri scurte.

## 2. Date existente (verificate în cod, 28.10.2026)

**Logen** (tabel `logen`, standort Wuppertal `00000000-0000-0000-0000-000000000001`), 12 în total:
- 7 loje tematice (Paw Patrol Jungs, Paw Patrol Mädchen, Marvel Spiderman, Anna & Elsa,
  Safari, Einhorn Schloss, Einhorn Regenbogen), max 16 copii, 2 tische
- 2 Babywelt (Babywelt Junge, Babywelt Märchen), `ist_babywelt=true`, max 20
- BBQ Zelt: `kapazitaet_flexibel=true`, un singur grup pe slot
- Runde Tische unten: max 20, cu regulă de disponibilitate pe weekend
- Gruppen: `kapazitaet_flexibel`, `NUR_WOCHENTAG`. **Online: NU.**

⚠️ Migrația 004 setează pentru „Runde Tische unten” regula `SA_SO_SLOT1`, dar codul
(`logeIstVerfuegbarFuerSlot`) cunoaște doar `KEIN_WE_NACHMITTAG` și `NUR_WOCHENTAG`.
Înainte de faza 2, cere-i lui Valeriu rezultatul acestui query și adaptează-te după valorile reale:
```sql
select name, max_kinder, ist_babywelt, kapazitaet_flexibel, verfuegbarkeit_regel, aktiv from logen order by name;
```

**Reguli de capacitate** (identice cu `api/lena/verfuegbarkeit` și `api/lena/reservierungen`):
- Loje normale: max 2 grupuri pe slot. Un grup cu ≥10 copii blochează loja exclusiv. Al doilea
  grup e posibil doar dacă ambele au <10 copii și suma ≤ `max_kinder`. Rest minim afișat: 6.
- `kapazitaet_flexibel`: un singur grup pe slot. Online limitezi la `max_kinder`.
- Rezervările cu `status='STORNIERT'` nu ocupă loc.

**Sloturi și prețuri:** se refolosesc `src/lib/utils/zeitslots.ts`, `src/lib/utils/preise.ts`
și `istPreisteuerterTag()` din `src/lib/utils/feiertage.ts` (weekend + sărbători + vacanțe NRW).
Nu duplica niciun preț și nicio oră în codul nou.

**Tipul rezervării online:** `ist_babywelt` → `BABYWELT_GEBURTSTAG`, altfel `GEBURTSTAG`.

## 3. Probleme existente care trebuie rezolvate (în fazele de mai jos)

1. **Fără protecție la rezervare dublă în DB.** Constraint-ul UNIQUE a fost șters (004).
   Verificarea se face read-then-insert în TS, deci două cereri simultane pot rezerva
   aceeași lojă. Pentru public e obligatorie o funcție Postgres atomică (faza 2).
2. **Statistica Lena numără orice rezervare cu `erstellt_von IS NULL`**: `src/lib/supabase/queries.ts`
   (getLenaStatistik) și `src/app/api/webhooks/retell/route.ts` (2 locuri). Rezervările
   online ar fi socotite ca Lena. Fix: filtrează după `angenommen_von = 'KI LENA'` (faza 1).
3. **Rutele Lena actualizează numele/emailul unui client existent găsit după telefon.**
   Online asta e interzis (vezi 5.3).
4. **`cancel_url` din Stripe trimite la `/zahlung/abgebrochen`, dar pagina nu există.**
   Creeaz-o în faza 4 (o pagină simplă e suficientă, e folosită și de Lena).
5. **Webhook-ul Stripe trimite emailul de confirmare doar dacă emailul era necunoscut.**
   Online emailul e cunoscut de la început, deci clientul n-ar primi nimic. Vezi 5.4.

## 4. Structura fișierelor (nou = ★, modificat = ✎)

```
docs/module/online-buchung.md                       ★ acest document
supabase/migrations/011_online_buchung.sql          ★
scripts/test-online-doppelbuchung.ts                ★ test de concurență
src/lib/verfuegbarkeit.ts                           ★ logica de disponibilitate, comună Lena + online
src/lib/online-buchung/
  ├── konfiguration.ts                              ★ constante (vorlauf, hold, limite)
  ├── validierung.ts                                ★ validare input
  ├── schutz.ts                                     ★ Turnstile + rate limit
  └── bestaetigung.ts                               ★ SMS + email după plată (idempotent)
src/app/buchen/[standort]/
  ├── page.tsx                                      ★ wizard
  ├── layout.tsx                                    ★ layout public (fără Sidebar staff)
  ├── erfolg/page.tsx                               ★ după plată
  └── abgebrochen/page.tsx                          ★ plată anulată → eliberează slotul
src/components/buchen/                              ★ componente UI ale wizard-ului
src/app/api/buchen/[standort]/
  ├── monat/route.ts                                ★ GET ?monat=YYYY-MM
  ├── tag/route.ts                                  ★ GET ?datum=YYYY-MM-DD
  └── reservieren/route.ts                          ★ POST
src/app/zahlung/abgebrochen/page.tsx                ★ (bug existent, punctul 3.4)
src/app/datenschutz/page.tsx                        ★ sau link către Datenschutz Upsalla (vezi Faza 6)
src/lib/stripe/client.ts                            ✎ opțiuni: valabilitate, success/cancel URL
src/app/api/webhooks/stripe/route.ts                ✎ + checkout.session.expired, + confirmare online
src/app/api/lena/verfuegbarkeit/route.ts            ✎ folosește src/lib/verfuegbarkeit.ts
src/lib/supabase/queries.ts                         ✎ filtru statistică Lena
src/app/api/webhooks/retell/route.ts                ✎ filtru statistică Lena
src/proxy.ts                                        ✎ excepții buchen + api/buchen
next.config.ts                                      ✎ header frame-ancestors pentru /buchen
```

## 5. Specificație tehnică

### 5.1 Migrația `011_online_buchung.sql`

```sql
-- Standort-Slug für öffentliche URL + Schalter
alter table standorte add column if not exists slug text unique;
alter table standorte add column if not exists online_buchung_aktiv boolean not null default false;
update standorte set slug = 'upsalla' where id = '00000000-0000-0000-0000-000000000001';

-- Pro Loge online buchbar? (Gruppen: nein)
alter table logen add column if not exists online_buchbar boolean not null default true;
update logen set online_buchbar = false where name = 'Gruppen';

-- Online-Hold: bis wann blockiert eine unbezahlte Online-Buchung den Slot
alter table reservierungen add column if not exists online_hold_bis timestamptz;
-- Schutz gegen doppeltes Absenden (Client generiert UUID pro Wizard-Durchlauf)
alter table reservierungen add column if not exists idempotenz_schluessel uuid unique;
-- Idempotenz der Bestätigung (SMS/E-Mail nur einmal)
alter table reservierungen add column if not exists bestaetigung_gesendet_am timestamptz;

-- Rate-Limit-Protokoll (nur gehashte IP, DSGVO)
create table if not exists online_buchung_versuche (
  id bigserial primary key,
  ip_hash text not null,
  erstellt_am timestamptz not null default now()
);
create index if not exists online_buchung_versuche_idx on online_buchung_versuche (ip_hash, erstellt_am desc);
alter table online_buchung_versuche enable row level security;  -- keine Policies = nur service_role
```

**Funcția atomică** `reserviere_online(...)`: `SECURITY DEFINER`, `EXECUTE` revocat de la
`public, anon, authenticated` și acordat doar lui `service_role`.
- Parametri: standort_id, loge_id, kunde_id, typ, datum, zeitslot, kinder_anzahl,
  erwachsene_anzahl, paket_preis_pro_kind, gesamtbetrag, anzahlung_betrag, notizen,
  idempotenz_schluessel, hold_minuten.
- Pași:
  1. `pg_advisory_xact_lock(hashtext(loge_id::text || datum::text || zeitslot::text))`
  2. Dacă `idempotenz_schluessel` există deja → returnează id-ul existent (fără eroare).
  3. Încarcă loja. Dacă nu există, nu e `aktiv`, nu e `online_buchbar` sau e alt standort → eroare `LOGE_UNGUELTIG`.
  4. Ocupare = rezervările pe loje/dată/slot cu `status <> 'STORNIERT'`, **exclusiv** cele online
     expirate (`angenommen_von='ONLINE' and status='BESTAETIGT_AUSSTEHEND' and online_hold_bis < now()`).
  5. Aplică regulile de capacitate din secțiunea 2. Eroare `SLOT_BELEGT` / `KAPAZITAET` cu text.
  6. INSERT cu `status='BESTAETIGT_AUSSTEHEND'`, `angenommen_von='ONLINE'`, `erstellt_von=null`,
     `online_hold_bis = now() + hold_minuten`.
  7. Returnează `{ id }` sau `{ fehler, hinweis }` (jsonb).
- **Nu** reutiliza rândurile STORNIERT, cum face Lena. Online se face mereu INSERT nou.
- Rezervările online expirate nu sunt anulate în funcție (fără Stripe nu știm sigur că nu s-a
  plătit). Sunt doar ignorate la calculul ocupării. Statusul îl schimbă webhook-ul `expired`
  sau pagina `abgebrochen`.

Nota pentru mai târziu (nu în acest modul): Lena și staff încă nu folosesc lock-ul, deci o
cursă Lena-vs-online rămâne teoretic posibilă. După go-live, ruta Lena poate fi mutată pe aceeași
funcție (task separat).

### 5.2 Disponibilitate: `src/lib/verfuegbarkeit.ts`

- Extrage logica din `src/app/api/lena/verfuegbarkeit/route.ts` într-o funcție pură
  `berechneVerfuegbarkeit({ standortId, datum, nurOnlineBuchbar, ignoriereAbgelaufeneHolds })`.
- Ruta Lena o apelează cu parametrii care păstrează **exact** comportamentul actual
  (răspunsul JSON identic, inclusiv `hinweis_doppelbelegung`).
- Varianta online: `nurOnlineBuchbar=true`, `ignoriereAbgelaufeneHolds=true`.
- Funcție suplimentară `berechneMonatsuebersicht(standortId, 'YYYY-MM')` cu **un singur query**
  pentru toată luna. Returnează pentru fiecare zi: `geschlossen | ausgebucht | wenige | frei`
  (`wenige` = ≤2 combinații lojă/slot libere) și dacă e zi cu tarif de weekend.

### 5.3 API public

Toate rutele: `export const dynamic = 'force-dynamic'`, rezolvă `[standort]` prin `standorte.slug`,
iar dacă `online_buchung_aktiv=false` răspund cu 404.

**GET `/api/buchen/[standort]/monat?monat=YYYY-MM`**: rezultatul din `berechneMonatsuebersicht`.
Zilele din trecut sau mai devreme de `MIN_VORLAUF_TAGE` și cele după `MAX_VORAUS_TAGE` → `nicht_buchbar`.

**GET `/api/buchen/[standort]/tag?datum=YYYY-MM-DD`**: sloturile, lojele libere, `max_kinder`
rămas, prețul pe copil și ora slotului (`zeitslotZeitraum`). Nu returnează nimic despre alți
clienți, doar disponibilitatea.

**POST `/api/buchen/[standort]/reservieren`**. Body:
```ts
{ datum, zeitslot, loge_id, kinder_anzahl, erwachsene_anzahl,
  vorname, nachname, telefon, email, notizen?,
  agb_akzeptiert: true, datenschutz_akzeptiert: true, newsletter_opt_in: boolean,
  turnstile_token, idempotenz_schluessel, website /* honeypot, trebuie să fie gol */ }
```
Pași:
1. Honeypot gol, Turnstile valid, rate limit (max 5 cereri / 10 min / ip_hash). Altfel 429/400.
2. Validare (`validierung.ts`): dată în fereastra permisă, park deschis, slot existent în ziua
   respectivă, `kinder_anzahl` 1–20, `erwachsene_anzahl` 0–20, telefon valid
   (`istGueltigeTelefonnummer`), email obligatoriu și valid, nume 1–60 caractere, notițe ≤500, ambele bife true.
3. Prețuri server-side: `istPreisteuerterTag` → `berechneGesamtbetrag` → `berechneAnzahlung`.
   **Nu accepta niciodată prețuri din client.**
4. Client: caută după telefonul normalizat.
   - Dacă există: folosește `kunde_id` și **NU modifica** nume/email. Dacă numele introdus diferă,
     adaugă în `notizen`: `Online angegeben: <Vorname Nachname>, <email>`.
   - Dacă nu există: INSERT cu `dsgvo_einwilligung=true` și `newsletter_opt_in` exact cum a bifat.
5. `rpc('reserviere_online', …)` cu `hold_minuten = HOLD_MINUTEN`. La eroare → 409 cu `hinweis`.
6. Stripe Checkout (5.4). Salvează `stripe_session_id`, `stripe_payment_link`.
   Dacă Stripe eșuează → setează rezervarea STORNIERT și răspunde 502.
7. Răspuns `{ checkout_url }`. Browserul face redirect cu `window.top.location.href`
   (funcționează și din iframe).
- **Nu** se trimite SMS la creare. Doar după plată.

### 5.4 Stripe

- `erstelleAnzahlungsSession` primește opțiuni noi (cu default-urile actuale, ca Lena să nu
  se schimbe): `gueltigkeitSekunden` (default 24h), `successUrl`, `cancelUrl`, `metadata`
  suplimentare.
- Online: valabilitate **30 min** (minimul Stripe), `metadata.quelle='ONLINE'`,
  success → `/buchen/[standort]/erfolg?session_id={CHECKOUT_SESSION_ID}`,
  cancel → `/buchen/[standort]/abgebrochen?session_id={CHECKOUT_SESSION_ID}`.
  `customer_email` precompletat. Același `custom_text` cu condițiile de anulare.
- `HOLD_MINUTEN = 35` (5 minute marjă peste valabilitatea Stripe).
- **Webhook `checkout.session.expired`** (nou): dacă rezervarea are `angenommen_von='ONLINE'`,
  status `BESTAETIGT_AUSSTEHEND` și același `stripe_session_id` → `STORNIERT`, fără SMS.
  ⚠️ Valeriu trebuie să activeze evenimentul `checkout.session.expired` în Stripe Dashboard,
  pe endpoint-ul de webhook existent.
- **Webhook `checkout.session.completed`**: logica existentă rămâne. Pentru `angenommen_von='ONLINE'`
  se apelează în schimb `bestaetigeOnlineBuchung(id)` din `bestaetigung.ts`.
- **Pagina `abgebrochen`**: încarcă sesiunea din Stripe. Dacă nu e plătită → `stripe.checkout.sessions.expire`
  + rezervarea STORNIERT (slotul se eliberează imediat) + buton „Neuen Termin wählen”.
- Cron-ul `stripe-abgleich` acoperă deja și online (caută după `metadata.reservierung_id`).
  Verifică doar că apelează tot `bestaetigeOnlineBuchung` pentru rezervările online.
- Caz rar: plata confirmată pentru o rezervare online al cărei hold a expirat, iar slotul a fost
  între timp ocupat de altcineva. Webhook-ul o setează totuși BEZAHLT și creează o înregistrare
  în `kunden_anfragen` („Online-Buchung bezahlt, Slot evtl. doppelt belegt – bitte prüfen”).

### 5.5 Confirmarea: `bestaetigung.ts`

`bestaetigeOnlineBuchung(reservierungId)`, **idempotentă** prin `bestaetigung_gesendet_am`
(UPDATE … WHERE bestaetigung_gesendet_am IS NULL RETURNING → trimite doar dacă a returnat un rând):
- SMS GSM-7, același text ca în webhook-ul actual (termen fix + Restbetrag la fața locului).
- Email `buchungsbestaetigungHtml` + atașament ICS (ca în webhook-ul actual).
- Opțional (constantă în `konfiguration.ts`): email de notificare la staff
  `upsalla.reservierung@gmail.com`: „Neue Online-Buchung”.

### 5.6 UI: `/buchen/[standort]`

Mobile-first (majoritatea părinților vin de pe telefon), butoane ≥48px, design curat, în
culorile Upsalla, fără Sidebar staff. Wizard în 5 pași, cu bară de progres:
1. **Datum**: calendar lunar din `/monat`. Zile gri = nerezervabile, punct portocaliu = `wenige`.
2. **Uhrzeit & Loge**: sloturile zilei, apoi cardurile lojelor libere (nume, „bis X Kinder”,
   eticheta „Babywelt”). Lojele parțial ocupate apar normal, cu limita corectă de copii.
3. **Personen**: număr copii (stepper, max = limita lojei; dacă e parțial ocupată, max 9),
   număr adulți (stepper). Preț live: „Gesamt X € · Anzahlung heute Y €”, cu nota
   „mindestens 6 Kinder werden berechnet · 3 Begleitpersonen frei”.
4. **Kontakt**: Vorname, Nachname, Telefon, E-Mail, Notizen (opțional),
   checkbox AGB (link `/agb`), checkbox Datenschutz (link), checkbox Newsletter (opțional, nebifat).
   Turnstile. Câmp honeypot ascuns `website`.
5. **Übersicht**: tot rezumatul + condițiile de anulare (același text ca în Stripe)
   → buton „Zahlungspflichtig buchen – Anzahlung Y €” → redirect către Stripe.
- `idempotenz_schluessel` = `crypto.randomUUID()` generat la încărcarea wizard-ului.
- Dacă POST-ul răspunde 409 (slot luat între timp): mesaj prietenos, întoarcere la pasul 2 cu
  disponibilitatea reîncărcată.
- **erfolg**: „Euer Termin ist fix!” + rezumat + „Bestätigung kommt per SMS und E-Mail”.
  Dacă webhook-ul n-a sosit încă: „Zahlung wird bestätigt…” cu reîncărcare automată după câteva secunde.

### 5.7 Securitate și integrare

- `src/proxy.ts`: adaugă `buchen` și `api/buchen` în lista de excepții a matcher-ului (lângă `zahlung|agb|p/`).
- `next.config.ts`: pentru `/buchen/:path*` setează header
  `Content-Security-Policy: frame-ancestors 'self' https://upsalla-kinderpark.de https://www.upsalla-kinderpark.de`.
- Env noi: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `IP_HASH_SALT`
  (local în `.env.local` + în Vercel). În development, fără chei → Turnstile e sărit, cu log de avertizare.
- `konfiguration.ts`: `MIN_VORLAUF_TAGE = 2`, `MAX_VORAUS_TAGE = 180`, `HOLD_MINUTEN = 35`,
  `STRIPE_GUELTIGKEIT_SEKUNDEN = 1800`, `RATE_LIMIT = { anzahl: 5, minuten: 10 }`.
  Valorile de vorlauf se confirmă cu Upsalla.
- Cron `anfragen-cleanup` (sau unul existent, nu adăuga cron nou): șterge `online_buchung_versuche` mai vechi de 7 zile.

## 6. Faze

Prompt de start pentru fiecare fază în terminal:
`Lies docs/module/online-buchung.md. Wir machen jetzt Phase N. Erst Plan zeigen, dann umsetzen.`

- **Faza 0: pregătire.** Branch `feature/online-buchung`. Citește documentele Next 16 relevante
  (route handlers, dynamic params ca Promise, headers în next.config, proxy).
- **Faza 1: fix statistică Lena** (3.2). Mică și independentă, se poate face deploy imediat.
- **Faza 2: DB.** Migrația 011 + funcția `reserviere_online` + `scripts/test-online-doppelbuchung.ts`
  (20 de apeluri RPC paralele pe aceeași lojă/slot → exact 1 sau 2 reușite, conform regulilor;
  rulează pe o dată de test îndepărtată, apoi șterge datele de test). STOP: Valeriu rulează migrația.
- **Faza 3: disponibilitate.** `src/lib/verfuegbarkeit.ts` + refactor ruta Lena (verifică
  răspuns identic înainte/după pe 3 date: zi de lucru, sâmbătă, zi deja ocupată) + rutele `monat` și `tag` + `proxy.ts`.
- **Faza 4: rezervare + plată.** `reservieren` + extindere Stripe + webhook `expired` +
  `bestaetigung.ts` + paginile `erfolg`, `abgebrochen` și `/zahlung/abgebrochen`.
  Test cu `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- **Faza 5: UI wizard.** Componentele din `src/components/buchen/`. Testează pe viewport 375px.
- **Faza 6: protecție + legal.** Turnstile, rate limit, honeypot, header iframe, link Datenschutz.
- **Faza 7: test end-to-end și go-live.** Stripe test mode pe Vercel Preview: rezervare completă,
  anulare, expirare (sesiune de 30 min), doi utilizatori pe aceeași lojă, iframe pe o pagină de test.
  Apoi `online_buchung_aktiv=true` în producție.

## 6a. Note din Faza 0 (Next 16.2.9, verificat în `node_modules/next/dist/docs/`)

- **Route handlers**: `params` e **Promise** (accesul sincron e scos complet în 16):
  `export async function GET(req: NextRequest, ctx: RouteContext<'/api/buchen/[standort]/tag'>) { const { standort } = await ctx.params }`.
  `RouteContext` / `PageProps` / `LayoutProps` sunt helper-e globale (generate la `next build`/`next dev`, fără import).
  Query: `request.nextUrl.searchParams`. Body: `await request.json()`.
- **Pagini**: `PageProps<'/buchen/[standort]'>` → `await props.params`, `await props.searchParams`.
  La fel `cookies()` / `headers()` din `next/headers` sunt doar async.
- **`export const dynamic = 'force-dynamic'`** e încă valabil (repo-ul nu are `cacheComponents` activat,
  iar toate rutele Lena îl folosesc deja). GET-urile din route handlers sunt oricum dinamice implicit din v15.
- **Proxy** (`src/proxy.ts`): rulează pe Node.js runtime, matcher-ul trebuie să fie constant.
  Excepțiile actuale sunt în negative lookahead-ul unic:
  `...|api/webhooks|api/lena|api/cron|zahlung|agb|p/).*)`. În Faza 3 adaugi `buchen|api/buchen` în aceeași listă.
  Atenție: lookahead-ul e prefix fără `/`, deci `buchen` exclude și `/buchenXYZ` (acceptabil, ca la `zahlung`).
  `updateSession` redirecționează tot ce nu e exclus și nu e `/auth` către `/auth/login`.
- **Headers în `next.config.ts`**: `async headers() { return [{ source: '/buchen/:path*', headers: [...] }] }`.
  Se aplică **înaintea** proxy-ului, iar la aceeași cheie câștigă ultima regulă.
  `:path*` acoperă și `/buchen/upsalla` și `/buchen/upsalla/erfolg`. `X-Frame-Options` e depășit de `frame-ancestors`.
  Azi `next.config.ts` are doar `serverExternalPackages: ['googleapis']`, deci nu există conflicte.
- `next dev` scrie în `.next/dev`, deci `next build` poate rula în paralel cu dev.

## 7. De făcut de Valeriu (în afara codului)

- [ ] Rulează migrația 011 în Supabase
- [ ] Stripe Dashboard: webhook + evenimentul `checkout.session.expired`
- [ ] Cont Cloudflare Turnstile (gratuit) → chei în `.env.local` și Vercel
- [ ] Upsalla: confirmă vorlauf-ul minim (2 zile?) și cât de departe în viitor se poate rezerva
- [ ] Upsalla: textul Datenschutz pentru rezervarea online (Upsalla e operatorul de date, SmartCallService
      e procesator → AVV). Verifică AGB-ul existent (`/agb`)
- [ ] Upsalla/David: butonul „Jetzt online buchen” pe upsalla-kinderpark.de

## Status

- [x] Faza 0  - [x] Faza 1  - [ ] Faza 2  - [ ] Faza 3
- [ ] Faza 4  - [ ] Faza 5  - [ ] Faza 6  - [ ] Faza 7
