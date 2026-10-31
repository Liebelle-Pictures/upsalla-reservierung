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

## 2. Date existente (verificate în cod 28.10.2026, logen live 31.10.2026)

**Logen** (tabel `logen`, standort Wuppertal `00000000-0000-0000-0000-000000000001`), 12 în total.
Valori live, verificate de Valeriu pe 31.10.2026 (toate `aktiv = true`):

| Lojă | max_kinder | ist_babywelt | kapazitaet_flexibel | verfuegbarkeit_regel | online |
|---|---|---|---|---|---|
| Anna & Elsa, Einhorn Regenbogen, Einhorn Schloss, Marvel Spiderman, Paw Patrol Jungs, Paw Patrol Mädchen, Safari | 16 | false | false | NULL | da |
| Babywelt Junge, Babywelt Märchen | 20 | true | false | NULL | da |
| BBQ Zelt | 20 | false | true | NULL | da |
| Runde Tische unten | 18 | false | false | `KEIN_WE_NACHMITTAG` | da |
| Gruppen | 150 | false | true | `NUR_WOCHENTAG` | **NU** (`online_buchbar = false`) |

✅ Regula `SA_SO_SLOT1` din migrația 004 e învechită. În DB e `KEIN_WE_NACHMITTAG`, pe care
`logeIstVerfuegbarFuerSlot` o cunoaște deja, deci codul existent e corect.
`reserviere_online` citește `max_kinder` din DB, nu are nicio valoare fixă.

⚠️ În DB există rezervări `INTERN_GESPERRT` cu <10 copii (ex. 6 sau 8). După regulile Lenei, lângă
ele s-ar mai putea rezerva un al doilea grup. **Online**, un `INTERN_GESPERRT` blochează slotul complet.
(Pentru Lena nu s-a schimbat nimic. Dacă trebuie aliniat, e un task separat.)

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
- Parametri (prefix `p_`): standort_id, loge_id, kunde_id, datum, zeitslot, kinder_anzahl,
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
- **Implementat în Faza 2, cu abateri față de schița de mai sus:** `typ` nu mai e parametru, funcția îl
  derivă din `ist_babywelt`. Un `INTERN_GESPERRT` în slot blochează complet. Un `idempotenz_schluessel`
  repetat returnează `{ id, wiederholt: true, status }`. Dacă `status = 'STORNIERT'`, clientul are nevoie de cheie nouă.
  Test: `npx tsx --env-file=.env.local scripts/test-online-doppelbuchung.ts`.
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

- **Implementat în Faza 3, cu abateri:** în loc de `nurOnlineBuchbar` + `ignoriereAbgelaufeneHolds`
  există un singur parametru `modus: 'LENA' | 'ONLINE'`, ca regulile online să nu poată fi amestecate.
  `ONLINE` = exact regulile din `reserviere_online`: doar `online_buchbar`, `INTERN_GESPERRT` blochează complet,
  holds online expirate ignorate, flexibel limitat la `max_kinder`, al doilea grup max 9 copii.
  Online poate fi mai strict decât funcția (ex. `verfuegbarkeit_regel`, pe care funcția SQL nu o verifică →
  Faza 4 trebuie să valideze slotul cu `logeIstVerfuegbarFuerSlot` în `reservieren`), dar niciodată mai larg.
  Ruta Lena verificată identic byte cu byte pe 11 date × GET/POST + 401.
  Logica pură: `berechneFreieSlots(...)` (testabilă fără DB). Zile cu tarif weekend pe lună:
  `ladePreisteuerteTage(von, bis)` în `feiertage.ts` (un singur query pentru vacanțe).
  Test: `npx tsx --env-file=.env.local scripts/test-verfuegbarkeit.ts` (include comparația live cu `reserviere_online`).
  Dev local: `ONLINE_BUCHUNG_SCHALTER_IGNORIEREN=true npm run dev` ignoră `online_buchung_aktiv` (doar în development).

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

- **Implementat în Faza 4, cu abateri/precizări:**
  - `client.ts`: funcție pură `baueAnzahlungsSessionParameter`; opțiuni noi `gueltigkeitSekunden`, `successUrl`,
    `cancelUrl`, `zusatzMetadata` (nu poate suprascrie `reservierung_id`). Textul de storno e în `src/lib/stripe/texte.ts`
    (fără import Stripe, utilizabil în widget). Lena verificată cu `scripts/test-stripe-lena-unveraendert.ts`
    (compară cu funcția reală de la commit-ul `167f2e1`, plus sesiune reală în test mode, plus text SMS).
  - Comutatorul în webhook/cron e `metadata.quelle === 'ONLINE'`: blocul Lena din webhook are **0 linii modificate**.
    Se tratează și `checkout.session.async_payment_succeeded` (doar online).
  - success/cancel URL se construiesc din `request.nextUrl.origin` (merge local, pe Vercel Preview și în producție).
  - `reservieren` răspunde la 409 cu `{ grund, hinweis }`. `grund`: `ABGELAUFEN` / `SCHLUESSEL_VERWENDET`
    → widget-ul generează cheie nouă; `SLOT_BELEGT` / `KAPAZITAET` / `LOGE_UNGUELTIG` → înapoi la pasul 2;
    `IN_BEARBEITUNG` → repetă același request; `BEREITS_BEZAHLT`. O cheie repetată cu rezervarea STORNIERT
    sau cu sesiunea expirată → `ABGELAUFEN` („Die Zeit ist abgelaufen, bitte startet die Buchung neu.”).
  - Căutarea clientului compară telefoanele normalizat (E.164), pentru că în DB formatele sunt amestecate
    (`0…`, `+49…`, cu spații). Clienții noi se salvează `0…` fără spații.
  - Sesiunile online setează explicit `payment_method_types`: `card` (include Apple Pay/Google Pay) + `paypal` / `klarna`
    doar dacă sunt active în cont (citit din `paymentMethodConfigurations`, cache 10 min, fallback `card`).
    Fără SEPA sau alte metode întârziate (hold 30 min). Sesiunile Lenei nu au `payment_method_types` (Dashboard decide, ca înainte).
  - `checkout.session.async_payment_failed` (online) → STORNIERT, fără SMS (plasă de siguranță).
  - Pagina `erfolg` la `complete` + `unpaid`: se reîncarcă de maximum 5 ori, apoi afișează textul final
    „Eure Zahlung wird bearbeitet. Sobald sie bestätigt ist, bekommt ihr SMS und E-Mail.”
  - Turnstile și rate limit nu sunt încă implementate (Faza 6). Marcajul e în `reservieren/route.ts`.
  - Test: `npx tsx --env-file=.env.local scripts/test-online-reservieren.ts` (cu dev server + `stripe listen`),
    `--zahlung` pentru cele 2 plăți manuale de test (linkurile se deschid automat în browser).
  - Verificat 31.10.2026: ambele scripturi verzi, inclusiv plăți reale în test mode (online + Lena);
    SMS și email primite. Lena: BEZAHLT, email preluat din Stripe, `bestaetigung_gesendet_am` rămâne NULL.

### 5.5 Confirmarea: `bestaetigung.ts`

`bestaetigeOnlineBuchung(reservierungId)`, **idempotentă** prin `bestaetigung_gesendet_am`
(UPDATE … WHERE bestaetigung_gesendet_am IS NULL RETURNING → trimite doar dacă a returnat un rând):
- SMS GSM-7, același text ca în webhook-ul actual (termen fix + Restbetrag la fața locului).
- Email `buchungsbestaetigungHtml` + atașament ICS (ca în webhook-ul actual).
- Email de notificare la staff „Neue Online-Buchung”: destinatarul vine din env `STAFF_NOTIFICARE_EMAIL`
  (local `valeriuleo@gmail.com`, producție `upsalla.reservierung@gmail.com`). Dacă variabila lipsește, nu se trimite nimic.

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

- **Implementat în Faza 5, cu precizări:**
  - Componente în `src/components/buchen/`: `BuchungsWizard` (client, starea celor 5 pași), `Schritt*`, `Fortschritt`,
    `ui.tsx` (butoane ≥48px), `OeffentlicherRahmen` (logo + footer, folosit și de `/zahlung/abgebrochen`).
    Logica pură e în `wizardLogik.ts` (preț live din `preise.ts`, validare contact, reacția la răspunsurile `reservieren`).
    Test: `npx tsx scripts/test-buchen-wizard.ts`.
  - Culori Upsalla (din CSS-ul upsalla-kinderpark.de) ca token-uri Tailwind `ups-*` în `globals.css`; titluri în Fredoka; logo în `public/buchen/`.
  - Fiecare pas e o intrare în istoricul browserului (butonul „înapoi” de pe telefon = pasul anterior).
  - 409: `ABGELAUFEN`/`SCHLUESSEL_VERWENDET` → cheie nouă, datele rămân, mesaj în Übersicht; `SLOT_BELEGT`/`KAPAZITAET`/`LOGE_UNGUELTIG`
    → pasul 2, `/tag` reîncărcat, loja deselectată; `IN_BEARBEITUNG` → reîncercare automată (max 5 × 2 s); 400 cu `feld` → pasul câmpului.
  - Datenschutz: provizoriu link la `upsalla-kinderpark.de/datenschutzerklaerung` (`konfiguration.ts`), decizia finală în Faza 6.
    `turnstile_token` se trimite `null` până în Faza 6.
- **Faza 5b:**
  - `/tag` returnează pe fiecare lojă `geteilt` (= `teil_belegt`, fără detalii despre celălalt grup) și `bild_url`.
    Card: etichetă scurtă „Geteilte Loge · eigener Tisch” sau „Ganze Loge für euch”; deasupra listei, o singură dată
    (doar dacă există loje geteilt), explicația completă. În Übersicht: caseta lungă „Geteilte Loge – ihr habt euren eigenen Tisch…”.
  - Iconițe SVG proprii, generice (`LogenSymbol.tsx`, alocare după numele lojei, fallback balon), fără personaje/logouri.
  - Fără emoji în widget și în paginile de stare: `StatusSymbol.tsx` (erfolg, warten, zurück, warnung, info, bifă).
  - Migrația `012_logen_bild.sql`: `logen.bild_url` (doar https). Dacă e setată, cardul arată poza, altfel iconița.
    Se încarcă separat (`logenBilder.ts`), deci ruta Lena nu se schimbă, iar fără migrație nu apare nicio eroare.

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

- [x] Rulează migrația 011 în Supabase (31.10.2026)
- [x] Rulează migrația 012 (`logen.bild_url`) în Supabase (31.10.2026, verificat: coloana există, `http://` respins de CHECK)
- [ ] Opțional: poze per lojă în `logen.bild_url` (URL https, ex. bucket public Supabase Storage)
- [ ] Stripe Dashboard: webhook + evenimentele `checkout.session.expired`, `checkout.session.async_payment_succeeded`
      și `checkout.session.async_payment_failed`
- [ ] Vercel: env `STAFF_NOTIFICARE_EMAIL=upsalla.reservierung@gmail.com` (Production)
- [ ] Cont Cloudflare Turnstile (gratuit) → chei în `.env.local` și Vercel
- [ ] Upsalla: confirmă vorlauf-ul minim (2 zile?) și cât de departe în viitor se poate rezerva
- [ ] Upsalla: textul Datenschutz pentru rezervarea online (Upsalla e operatorul de date, SmartCallService
      e procesator → AVV). Verifică AGB-ul existent (`/agb`)
- [ ] Upsalla/David: butonul „Jetzt online buchen” pe upsalla-kinderpark.de

## 8. Task-uri separate după go-live (nu în acest modul)

- **Normalizarea telefoanelor din `kunden`.** În DB formatele sunt amestecate (`0…`, `+49…`, cu și fără spații;
  la 31.10.2026: 355 × `0…`, 36 × `+…`, 9 × alt format, 141 cu spații). Unele numere sunt salvate fără 0 inițial
  (ex. `15255805519`): nu sunt recunoscute online, iar SMS-urile Twilio către ele eșuează (`zuE164` nu le poate converti).
  De făcut: numără câți clienți au format greșit, stabilește formatul țintă (`0…` fără spații, ca la clienții online)
  și normalizează (cu verificare de duplicate după normalizare). Rutele Lena ar trebui apoi să salveze același format.
- Lena/staff pe funcția atomică `reserviere_online` (vezi 5.1).

## Status

- [x] Faza 0  - [x] Faza 1  - [x] Faza 2  - [x] Faza 3
- [x] Faza 4  - [x] Faza 5  - [ ] Faza 6  - [ ] Faza 7
