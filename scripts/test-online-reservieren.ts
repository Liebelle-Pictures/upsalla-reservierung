// Integrationstest Phase 4: POST /api/buchen/[standort]/reservieren + Stripe-Webhook + Seiten.
// Braucht einen laufenden Dev-Server und `stripe listen` (siehe docs/module/online-buchung.md).
//
//   npx tsx --env-file=.env.local scripts/test-online-reservieren.ts            # automatisch, keine Zahlung, keine SMS
//   npx tsx --env-file=.env.local scripts/test-online-reservieren.ts --zahlung  # + 2 Testzahlungen im Browser (SMS/E-Mail an Testkunden)
//
// Nur Stripe-TESTMODUS. Alle angelegten Reservierungen/Testkunden werden im finally gelöscht.
// Bestandskunden werden nie verändert oder gelöscht.

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { validiereBuchungsanfrage, normalisiereTelefon, buchungsfenster } from '../src/lib/online-buchung/validierung'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const BASIS = process.env.TEST_BASIS_URL ?? 'http://localhost:3000'
const SLUG = 'upsalla'
const STANDORT_ID = '00000000-0000-0000-0000-000000000001'
const FAKE_TELEFON = '0000 0000 093'          // Testkunde ohne echte Nummer (bekommt nie eine SMS)
const ECHT_TELEFON = '+49 15255805519'        // Valeriu, nur im Modus --zahlung
const ECHT_EMAIL = 'valeriuleo@gmail.com'
const UPSALLA_ADRESSEN = ['upsalla.reservierung@gmail.com', 'info@upsalla-kinderpark.de']
const MIT_ZAHLUNG = process.argv.includes('--zahlung')

let fehlgeschlagen = 0
function pruefe(bedingung: boolean, text: string, details?: unknown) {
  if (bedingung) console.log(`  ✓ ${text}`)
  else { fehlgeschlagen++; console.error(`  ✗ ${text}`, details ?? '') }
}

const angelegteReservierungen = new Set<string>()
const angelegteKunden = new Set<string>()

async function aufraeumen() {
  const ids = [...angelegteReservierungen]
  if (ids.length) {
    await supabaseAdmin.from('kunden_anfragen').delete().in('reservierung_id', ids)
    const { error } = await supabaseAdmin.from('reservierungen').delete().in('id', ids)
    if (error) console.error('Aufräumen Reservierungen fehlgeschlagen:', error.message, ids)
  }
  const kunden = [...angelegteKunden]
  if (kunden.length) {
    const { error } = await supabaseAdmin.from('kunden').delete().in('id', kunden)
    if (error) console.error('Aufräumen Kunden fehlgeschlagen:', error.message, kunden)
  }
  console.log(`\nAufgeräumt: ${ids.length} Reservierung(en), ${kunden.length} Testkunde(n).`)
}

async function warteBis<T>(fn: () => Promise<T | null | undefined | false>, ms: number, intervall = 1000): Promise<T | null> {
  const ende = Date.now() + ms
  while (Date.now() < ende) {
    const r = await fn()
    if (r) return r
    await new Promise(res => setTimeout(res, intervall))
  }
  return null
}

function plusTage(datum: string, tage: number): string {
  const [j, m, t] = datum.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10)
}

interface TagLoge { loge_id: string; name: string; ist_babywelt: boolean; max_kinder: number }
interface TagAntwort { buchbar: boolean; wochenendpreis?: boolean; slots: Array<{ zeitslot: number; logen: TagLoge[] }> }

async function ladeTag(datum: string): Promise<TagAntwort> {
  const r = await fetch(`${BASIS}/api/buchen/${SLUG}/tag?datum=${datum}`)
  return r.json() as Promise<TagAntwort>
}

// Werktag (Di-Do, keine Ferien/Feiertage) mit einer komplett freien normalen Loge in Slot 1
async function findeFreienTermin(ausschluss: string[] = []): Promise<{ datum: string; loge: TagLoge }> {
  const { bis } = buchungsfenster()
  for (let d = plusTage(bis, -40); d > plusTage(bis, -120); d = plusTage(d, -1)) {
    const wt = new Date(d + 'T00:00:00').getDay()
    if (wt < 2 || wt > 4 || ausschluss.includes(d)) continue
    const tag = await ladeTag(d)
    if (tag.wochenendpreis !== false) continue // Ferien/Feiertag → andere Preise und 2 Slots
    const slot = tag.slots?.find(s => s.zeitslot === 1)
    const loge = slot?.logen.find(l => !l.ist_babywelt && l.max_kinder === 16)
    if (loge) return { datum: d, loge }
  }
  throw new Error('Kein freier Testtermin gefunden')
}

async function findeSamstag(): Promise<string> {
  const { von } = buchungsfenster()
  let d = plusTage(von, 30)
  while (new Date(d + 'T00:00:00').getDay() !== 6) d = plusTage(d, 1)
  return d
}

async function logeIdPerName(name: string): Promise<string> {
  const { data } = await supabaseAdmin.from('logen').select('id').eq('standort_id', STANDORT_ID).eq('name', name).single()
  return data!.id
}

interface Antwort { status: number; body: { checkout_url?: string; grund?: string; hinweis?: string; feld?: string } }

// Jeder Request mit eigener (Test-)IP, damit das Rate-Limit (5/10 Min. pro IP) den Test nicht
// bremst. Das Rate-Limit selbst prüft scripts/test-schutz.ts. Turnstile: lokal Cloudflare-Testschlüssel
// (akzeptieren jedes Token) oder ohne Schlüssel übersprungen (nur development).
async function reservieren(daten: Record<string, unknown>): Promise<Antwort> {
  const testIp = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
  const r = await fetch(`${BASIS}/api/buchen/${SLUG}/reservieren`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': testIp }, body: JSON.stringify(daten),
  })
  return { status: r.status, body: await r.json() }
}

function buchung(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vorname: 'Test', nachname: 'Online Phase4', telefon: FAKE_TELEFON, email: 'test-phase4@example.com', notizen: 'Testbuchung Phase 4',
    // newsletter_opt_in: true wird vom Server ignoriert (Neukunden online immer false)
    agb_akzeptiert: true, newsletter_opt_in: true, website: '',
    turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX', idempotenz_schluessel: randomUUID(), erwachsene_anzahl: 4, ...over,
  }
}

async function ladeReservierung(schluessel: string) {
  const { data } = await supabaseAdmin.from('reservierungen').select('*').eq('idempotenz_schluessel', schluessel).maybeSingle()
  if (data) {
    angelegteReservierungen.add(data.id)
  }
  return data
}

async function merkeNeuenKunden(kundeId: string, vorherVorhanden: Set<string>) {
  if (!vorherVorhanden.has(kundeId)) angelegteKunden.add(kundeId)
}

async function kundenIdsMitTelefon(telefon: string): Promise<Set<string>> {
  const ziffern = telefon.replace(/\D/g, '').slice(-9)
  const { data } = await supabaseAdmin.from('kunden').select('id').ilike('telefon', `%${ziffern.split('').join('%')}%`)
  return new Set((data ?? []).map(k => k.id))
}

// ─── 1. Validierung (rein, ohne Server) ──────────────────────────────────────────
function testeValidierung() {
  console.log('\n1. Validierung (ohne Server)')
  const jetzt = new Date('2026-11-02T12:00:00Z')
  const gut = { datum: '2026-12-02', zeitslot: 1, loge_id: '6f1c2c1e-1111-4111-8111-111111111111', kinder_anzahl: 8, erwachsene_anzahl: 2, vorname: ' Anna ', nachname: 'Muster', telefon: '0152 123 456 78', email: ' Anna@Example.DE ', agb_akzeptiert: true, newsletter_opt_in: false, idempotenz_schluessel: randomUUID() }
  const r = validiereBuchungsanfrage(gut, jetzt)
  pruefe(r.ok, 'gültige Anfrage akzeptiert', r)
  if (r.ok) {
    pruefe(r.daten.telefon === '015212345678', `Telefon normalisiert (${r.daten.telefon})`)
    pruefe(r.daten.email === 'anna@example.de' && r.daten.vorname === 'Anna', 'E-Mail/Name getrimmt')
  }
  const fall = (over: Record<string, unknown>, feld: string, text: string) => {
    const e = validiereBuchungsanfrage({ ...gut, ...over }, jetzt)
    pruefe(!e.ok && e.feld === feld, text, e)
  }
  fall({ datum: '2026-11-03' }, 'datum', 'zu kurzfristig (< 2 Tage) abgelehnt')
  fall({ datum: '2027-06-01' }, 'datum', 'zu weit im Voraus (> 180 Tage) abgelehnt')
  fall({ datum: '2026-12-31' }, 'datum', 'Schließtag (Silvester) abgelehnt')
  fall({ datum: '2026-02-31' }, 'datum', 'ungültiges Datum abgelehnt')
  fall({ zeitslot: 3 }, 'zeitslot', 'Slot 3 abgelehnt')
  fall({ kinder_anzahl: 0 }, 'kinder_anzahl', '0 Kinder abgelehnt')
  fall({ kinder_anzahl: 21 }, 'kinder_anzahl', '21 Kinder abgelehnt')
  fall({ kinder_anzahl: 5.5 }, 'kinder_anzahl', 'Kommazahl abgelehnt')
  fall({ erwachsene_anzahl: 21 }, 'erwachsene_anzahl', '21 Erwachsene abgelehnt')
  fall({ telefon: 'Anna' }, 'telefon', 'ungültige Telefonnummer abgelehnt')
  fall({ email: '' }, 'email', 'fehlende E-Mail abgelehnt')
  fall({ email: 'kein-at.de' }, 'email', 'ungültige E-Mail abgelehnt')
  fall({ vorname: 'x'.repeat(61) }, 'vorname', 'Vorname > 60 Zeichen abgelehnt')
  fall({ notizen: 'x'.repeat(501) }, 'notizen', 'Notizen > 500 Zeichen abgelehnt')
  fall({ agb_akzeptiert: 'true' }, 'agb_akzeptiert', 'AGB muss exakt true sein')
  // Newsletter: Feld wird ignoriert (auch ungültige Werte führen nicht mehr zu 400)
  const nl = validiereBuchungsanfrage({ ...gut, newsletter_opt_in: 'ja' }, jetzt)
  pruefe(nl.ok && !('newsletter_opt_in' in nl.daten), 'newsletter_opt_in wird ignoriert', nl)
  // Datenschutz ist keine Einwilligung mehr (Art. 6 Abs. 1 lit. b DSGVO) → Feld wird ignoriert
  pruefe(validiereBuchungsanfrage({ ...gut, datenschutz_akzeptiert: false }, jetzt).ok, 'datenschutz_akzeptiert=false wird ignoriert')
  fall({ idempotenz_schluessel: 'abc' }, 'idempotenz_schluessel', 'ungültiger Idempotenz-Schlüssel abgelehnt')
  pruefe(normalisiereTelefon('+49 152 1234-5678') === '015212345678', '+49-Nummer → 0...')
  pruefe(normalisiereTelefon('+43 660 1234567') === '+436601234567', 'Auslandsnummer bleibt +..')
}

// ─── 2. Server: Buchung, Idempotenz, Regeln, Ablauf, Abbruch, Lena unberührt ───────
async function testeServer() {
  const { stripe, erstelleAnzahlungsSession } = await import('../src/lib/stripe/client')

  console.log('\n2a. Eingaben & Logen-Regeln über HTTP')
  const samstag = await findeSamstag()
  const rundeTische = await logeIdPerName('Runde Tische unten')
  const r1 = await reservieren(buchung({ datum: samstag, zeitslot: 2, loge_id: rundeTische, kinder_anzahl: 8 }))
  pruefe(r1.status === 409 && r1.body.grund === 'LOGE_UNGUELTIG', `Runde Tische unten, Samstag ${samstag} Slot 2 → 409 LOGE_UNGUELTIG (logeIstVerfuegbarFuerSlot)`, r1)
  const gruppen = await logeIdPerName('Gruppen')
  const { datum, loge } = await findeFreienTermin()
  // Vor der ersten erfolgreichen Buchung merken, welche Kunden es schon gibt (nur neue werden gelöscht)
  const vorherKunden = await kundenIdsMitTelefon(FAKE_TELEFON)
  const r2 = await reservieren(buchung({ datum, zeitslot: 1, loge_id: gruppen, kinder_anzahl: 8 }))
  pruefe(r2.status === 409 && r2.body.grund === 'LOGE_UNGUELTIG', 'Gruppen (online_buchbar=false) → 409', r2)
  const r3 = await reservieren(buchung({ datum, zeitslot: 1, loge_id: loge.loge_id, kinder_anzahl: 8, website: 'http://spam' }))
  pruefe(r3.status === 400, 'Honeypot ausgefüllt → 400', r3)
  const r4 = await reservieren(buchung({ datum, zeitslot: 1, loge_id: loge.loge_id, kinder_anzahl: 8, email: 'kaputt' }))
  pruefe(r4.status === 400 && r4.body.feld === 'email', 'ungültige E-Mail → 400 feld=email', r4)
  const r5 = await reservieren(buchung({ datum, zeitslot: 2, loge_id: loge.loge_id, kinder_anzahl: 8 }))
  pruefe(r5.status === 400 && r5.body.feld === 'zeitslot', `Slot 2 an Werktag ${datum} → 400`, r5)
  const r6 = await reservieren(buchung({ datum, zeitslot: 1, loge_id: loge.loge_id, kinder_anzahl: 8, gesamtbetrag: 1, anzahlung_betrag: 0.01, idempotenz_schluessel: randomUUID() }))

  console.log(`\n2b. Neue Buchung (${datum}, ${loge.name}, Slot 1, Neukunde)`)
  // r6 war schon die erste echte Buchung (mit eingeschmuggelten Preisen, die ignoriert werden müssen)
  pruefe(r6.status === 200 && !!r6.body.checkout_url, '200 + checkout_url', r6)
  const ersteBuchung = buchung({ datum, zeitslot: 1, loge_id: loge.loge_id, kinder_anzahl: 12 })
  // r6 gehört zu einem anderen Schlüssel → vorher einsammeln und freigeben, sonst blockiert sie den Slot
  const { data: r6Res } = await supabaseAdmin.from('reservierungen').select('id, stripe_session_id, gesamtbetrag, anzahlung_betrag, kunde_id').eq('datum', datum).eq('loge_id', loge.loge_id).eq('angenommen_von', 'ONLINE').neq('status', 'STORNIERT')
  for (const x of r6Res ?? []) {
    angelegteReservierungen.add(x.id)
    await merkeNeuenKunden(x.kunde_id, vorherKunden)
    // 8 Kinder Werktag: 8*23 = 184 €, 4 Erwachsene → 1 zahlend * 6.5 = 190.50 €, Anzahlung 38.10 €
    pruefe(Number(x.gesamtbetrag) === 190.5 && Number(x.anzahlung_betrag) === 38.1, `Preise serverseitig (${x.gesamtbetrag} / ${x.anzahlung_betrag}), Client-Preise ignoriert`)
    if (x.stripe_session_id) await stripe.checkout.sessions.expire(x.stripe_session_id).catch(() => undefined)
    await supabaseAdmin.from('reservierungen').update({ status: 'STORNIERT' }).eq('id', x.id)
  }

  const b1 = await reservieren(ersteBuchung)
  pruefe(b1.status === 200 && !!b1.body.checkout_url, '200 + checkout_url (12 Kinder)', b1)
  const res1 = await ladeReservierung(ersteBuchung.idempotenz_schluessel as string)
  pruefe(!!res1, 'Reservierung in DB')
  if (!res1) return
  await merkeNeuenKunden(res1.kunde_id, vorherKunden)
  pruefe(res1.status === 'BESTAETIGT_AUSSTEHEND' && res1.angenommen_von === 'ONLINE' && res1.erstellt_von === null, 'GELB, angenommen_von=ONLINE, erstellt_von=NULL')
  pruefe(res1.typ === 'GEBURTSTAG', `typ=${res1.typ}`)
  const holdMin = (new Date(res1.online_hold_bis).getTime() - new Date(res1.erstellt_am).getTime()) / 60000
  pruefe(holdMin > 34 && holdMin < 36, `Hold ${holdMin.toFixed(1)} Min. (≈35)`)
  pruefe(res1.zahlungslink_erstellt_am === null, 'zahlungslink_erstellt_am NULL (Lena-Erinnerungs-Cron greift nicht)')
  pruefe(!!res1.stripe_session_id && res1.stripe_payment_link === b1.body.checkout_url, 'stripe_session_id + stripe_payment_link gespeichert')
  const { data: kunde1 } = await supabaseAdmin.from('kunden').select('*').eq('id', res1.kunde_id).single()
  pruefe(kunde1?.telefon === '00000000093' && kunde1?.email === 'test-phase4@example.com' && kunde1?.newsletter_opt_in === false && kunde1?.dsgvo_einwilligung === false, 'Neukunde: Telefon normalisiert, E-Mail, newsletter_opt_in=false trotz true im Request, keine DSGVO-Einwilligung (Vertrag)', kunde1)
  const s1 = await stripe.checkout.sessions.retrieve(res1.stripe_session_id)
  pruefe(s1.metadata?.quelle === 'ONLINE' && s1.metadata?.reservierung_id === res1.id, 'Session-Metadaten quelle=ONLINE + reservierung_id')
  const dauer = s1.expires_at - s1.created
  pruefe(dauer >= 1795 && dauer <= 1805, `Session-Gültigkeit ${dauer} s (≈1800)`)
  pruefe(s1.success_url === `${BASIS}/buchen/${SLUG}/erfolg?session_id={CHECKOUT_SESSION_ID}`, `success_url ${s1.success_url}`)
  pruefe(s1.cancel_url === `${BASIS}/buchen/${SLUG}/abgebrochen?session_id={CHECKOUT_SESSION_ID}`, `cancel_url ${s1.cancel_url}`)
  pruefe(s1.customer_email === 'test-phase4@example.com', 'customer_email vorausgefüllt')
  const zahlarten = s1.payment_method_types ?? []
  pruefe(zahlarten.includes('card') && zahlarten.every(z => ['card', 'paypal', 'klarna'].includes(z)), `nur Sofort-Zahlarten: ${zahlarten.join(', ')} (kein SEPA)`)
  // 12 Kinder * 23 € + 1 zahlender Erwachsener * 6,50 € = 282,50 € → 20 % = 56,50 €
  pruefe(s1.amount_total === 5650 && Number(res1.anzahlung_betrag) === 56.5, `Anzahlung ${s1.amount_total} Cent (erwartet 5650)`)

  console.log('\n2c. Idempotenz')
  const b1b = await reservieren(ersteBuchung)
  pruefe(b1b.status === 200 && b1b.body.checkout_url === b1.body.checkout_url, 'gleicher Schlüssel → gleicher checkout_url', b1b)
  const b1c = await reservieren({ ...ersteBuchung, kinder_anzahl: 11 })
  pruefe(b1c.status === 409 && b1c.body.grund === 'SCHLUESSEL_VERWENDET', 'gleicher Schlüssel, andere Daten → 409 SCHLUESSEL_VERWENDET', b1c)

  console.log('\n2d. Kapazität (Slot mit 12 Kindern belegt)')
  const b2 = await reservieren(buchung({ datum, zeitslot: 1, loge_id: loge.loge_id, kinder_anzahl: 5 }))
  pruefe(b2.status === 409 && b2.body.grund === 'SLOT_BELEGT', 'zweite Gruppe in Loge mit ≥10 Kindern → 409 SLOT_BELEGT', b2)

  console.log('\n2e. Session abgelaufen → Webhook checkout.session.expired (braucht stripe listen)')
  // Gleichzeitig: Lena-Reservierung mit Lena-Session, die ebenfalls verfällt → darf sich NICHT ändern
  const { datum: datumLena, loge: logeLena } = await findeFreienTermin([datum])
  const { data: lenaKunde } = await supabaseAdmin.from('kunden').insert({ standort_id: STANDORT_ID, vorname: 'Test', nachname: 'LenaPhase4', telefon: '00000000094', dsgvo_einwilligung: true, newsletter_opt_in: false }).select('id').single()
  angelegteKunden.add(lenaKunde!.id)
  const { data: lenaRes } = await supabaseAdmin.from('reservierungen').insert({
    standort_id: STANDORT_ID, loge_id: logeLena.loge_id, kunde_id: lenaKunde!.id, typ: 'GEBURTSTAG', status: 'BESTAETIGT_AUSSTEHEND',
    datum: datumLena, zeitslot: 1, kinder_anzahl: 8, erwachsene_anzahl: 2, paket_preis_pro_kind: 23, gesamtbetrag: 184, anzahlung_betrag: 36.8,
    angenommen_von: 'KI LENA', notizen: 'TEST Phase 4 Lena-Weg',
  }).select('id').single()
  angelegteReservierungen.add(lenaRes!.id)
  const lenaSession = await erstelleAnzahlungsSession({ betragCent: 3680, reservierungId: lenaRes!.id, beschreibung: 'TEST Lena Phase 4' })
  await supabaseAdmin.from('reservierungen').update({ stripe_session_id: lenaSession.id, stripe_payment_link: lenaSession.url }).eq('id', lenaRes!.id)

  await stripe.checkout.sessions.expire(lenaSession.id)
  await stripe.checkout.sessions.expire(res1.stripe_session_id)
  const storniert = await warteBis(async () => {
    const { data } = await supabaseAdmin.from('reservierungen').select('status').eq('id', res1.id).single()
    return data?.status === 'STORNIERT'
  }, 30000)
  pruefe(!!storniert, 'Online-Buchung nach expired-Webhook STORNIERT', storniert === null ? 'Webhook nicht angekommen – läuft stripe listen und der Dev-Server mit dem whsec aus stripe listen?' : undefined)
  await new Promise(r => setTimeout(r, 4000)) // Lena-Event hatte genauso Zeit
  const { data: lenaNach } = await supabaseAdmin.from('reservierungen').select('status, stripe_session_id, aktualisiert_am').eq('id', lenaRes!.id).single()
  pruefe(lenaNach?.status === 'BESTAETIGT_AUSSTEHEND' && lenaNach?.stripe_session_id === lenaSession.id, 'Lena-Reservierung nach expired-Webhook UNVERÄNDERT (BESTAETIGT_AUSSTEHEND)', lenaNach)

  const b1d = await reservieren(ersteBuchung)
  pruefe(b1d.status === 409 && b1d.body.grund === 'ABGELAUFEN' && /abgelaufen/i.test(b1d.body.hinweis ?? ''), 'gleicher Schlüssel nach Ablauf → 409 ABGELAUFEN', b1d)

  console.log('\n2f. Slot wieder frei → neue Buchung, dann Abbruch über /abgebrochen')
  const b3 = buchung({ datum, zeitslot: 1, loge_id: loge.loge_id, kinder_anzahl: 9 })
  const b3r = await reservieren(b3)
  pruefe(b3r.status === 200, 'freigegebener Slot ist wieder buchbar', b3r)
  const res3 = await ladeReservierung(b3.idempotenz_schluessel as string)
  if (res3) {
    const seite = await fetch(`${BASIS}/buchen/${SLUG}/abgebrochen?session_id=${res3.stripe_session_id}`)
    const html = await seite.text()
    pruefe(seite.status === 200 && html.includes('Neuen Termin wählen'), 'Seite /abgebrochen lädt mit Button "Neuen Termin wählen"')
    const { data: nach } = await supabaseAdmin.from('reservierungen').select('status').eq('id', res3.id).single()
    pruefe(nach?.status === 'STORNIERT', 'Abbruch: Reservierung sofort STORNIERT')
    const s3 = await stripe.checkout.sessions.retrieve(res3.stripe_session_id)
    pruefe(s3.status === 'expired', 'Abbruch: Stripe-Session verfallen')
    const b3d = await reservieren(b3)
    pruefe(b3d.status === 409 && b3d.body.grund === 'ABGELAUFEN', 'gleicher Schlüssel nach Abbruch → 409 ABGELAUFEN', b3d)
  }

  console.log('\n2g. Lena-Seite /zahlung/abgebrochen (vorher 404)')
  const z = await fetch(`${BASIS}/zahlung/abgebrochen`)
  pruefe(z.status === 200 && (await z.text()).includes('Zahlung abgebrochen'), '/zahlung/abgebrochen → 200')
  const fremd = await fetch(`${BASIS}/buchen/${SLUG}/erfolg?session_id=${lenaSession.id}`)
  pruefe((await fremd.text()).includes('Buchung nicht gefunden'), 'Erfolgsseite zeigt für Lena-Session nichts an')
}

// ─── 3. Echte Testzahlungen (manuell im Browser) ────────────────────────────────
async function testeZahlung() {
  const { stripe, erstelleAnzahlungsSession } = await import('../src/lib/stripe/client')
  const { bestaetigeOnlineBuchung } = await import('../src/lib/online-buchung/bestaetigung')
  console.log('\n3. Testzahlungen (Karte 4242 4242 4242 4242, beliebiges künftiges Datum, beliebige CVC)')

  const vorherKunden = await kundenIdsMitTelefon(ECHT_TELEFON)
  const { data: vorherSnapshot } = await supabaseAdmin.from('kunden').select('*').in('id', [...vorherKunden]).order('id')

  // a) Online-Buchung mit echter Nummer (Bestandskunde → darf nicht verändert werden)
  const { datum, loge } = await findeFreienTermin()
  const online = buchung({ datum, zeitslot: 1, loge_id: loge.loge_id, kinder_anzahl: 7, telefon: ECHT_TELEFON, email: ECHT_EMAIL, vorname: 'Valeriu', nachname: 'Test Online', newsletter_opt_in: false })
  const r = await reservieren(online)
  if (r.status !== 200) { pruefe(false, 'Online-Buchung angelegt', r); return }
  const resOnline = await ladeReservierung(online.idempotenz_schluessel as string)
  await merkeNeuenKunden(resOnline!.kunde_id, vorherKunden)

  // b) Lena-Weg: eigener Testkunde (wird gelöscht), Session mit Standardwerten
  const { datum: datumLena, loge: logeLena } = await findeFreienTermin([datum])
  const { data: lk } = await supabaseAdmin.from('kunden').insert({ standort_id: STANDORT_ID, vorname: 'Valeriu', nachname: 'Test LenaWeg', telefon: '+4915255805519', dsgvo_einwilligung: true, newsletter_opt_in: false }).select('id').single()
  angelegteKunden.add(lk!.id)
  const { data: lr } = await supabaseAdmin.from('reservierungen').insert({
    standort_id: STANDORT_ID, loge_id: logeLena.loge_id, kunde_id: lk!.id, typ: 'GEBURTSTAG', status: 'BESTAETIGT_AUSSTEHEND',
    datum: datumLena, zeitslot: 1, kinder_anzahl: 8, erwachsene_anzahl: 2, paket_preis_pro_kind: 23, gesamtbetrag: 184, anzahlung_betrag: 36.8,
    angenommen_von: 'KI LENA', notizen: 'TEST Phase 4 Lena-Weg (Zahlung)',
  }).select('id').single()
  angelegteReservierungen.add(lr!.id)
  const ls = await erstelleAnzahlungsSession({ betragCent: 3680, reservierungId: lr!.id, beschreibung: 'TEST Lena-Weg Phase 4' })
  await supabaseAdmin.from('reservierungen').update({ stripe_session_id: ls.id, stripe_payment_link: ls.url }).eq('id', lr!.id)

  console.log(`\n  ► Online-Buchung bezahlen (${datum}, ${loge.name}):\n    ${r.body.checkout_url}`)
  console.log(`\n  ► Lena-Weg bezahlen (${datumLena}, ${logeLena.name}). Nach der Zahlung leitet Stripe auf freizo.app weiter –`)
  console.log(`    dort erscheint eine Fehlerseite (Produktion kennt Test-Sessions nicht). Das ist erwartet = unverändertes Lena-Verhalten:\n    ${ls.url}`)
  // Links direkt im Browser öffnen (lange URLs mit # brechen beim Kopieren aus dem Terminal leicht)
  if (process.platform === 'darwin') {
    const { execFileSync } = await import('node:child_process')
    for (const url of [r.body.checkout_url!, ls.url]) execFileSync('open', [url])
    console.log('\n  Beide Links wurden im Browser geöffnet (2 Tabs).')
  }
  console.log('\n  Warte auf beide Zahlungen (max. 25 Min.) …')

  const status = async (id: string) => (await supabaseAdmin.from('reservierungen').select('status').eq('id', id).single()).data?.status
  const beide = await warteBis(async () => (await status(resOnline!.id)) === 'BESTAETIGT_BEZAHLT' && (await status(lr!.id)) === 'BESTAETIGT_BEZAHLT', 25 * 60 * 1000, 3000)
  pruefe(!!beide, 'beide Zahlungen per Webhook als BEZAHLT verbucht')
  if (!beide) {
    // Zeit abgelaufen: Links verfallen lassen (Reservierungen werden gleich gelöscht), keine weiteren Prüfungen
    await stripe.checkout.sessions.expire(ls.id).catch(() => undefined)
    const { data: o } = await supabaseAdmin.from('reservierungen').select('stripe_session_id').eq('id', resOnline!.id).single()
    if (o?.stripe_session_id) await stripe.checkout.sessions.expire(o.stripe_session_id).catch(() => undefined)
    console.error('  Zeit abgelaufen, ohne dass beide Links bezahlt wurden. Links ungültig gemacht. Bitte Test neu starten.')
    return
  }
  await new Promise(res => setTimeout(res, 5000)) // SMS/E-Mail-Versand abschließen lassen

  console.log('\n  Online-Buchung:')
  const { data: o } = await supabaseAdmin.from('reservierungen').select('*').eq('id', resOnline!.id).single()
  pruefe(o?.status === 'BESTAETIGT_BEZAHLT' && !!o?.stripe_payment_intent_id, 'GRÜN + payment_intent gespeichert')
  pruefe(!!o?.bestaetigung_gesendet_am, 'bestaetigung_gesendet_am gesetzt (SMS/E-Mail einmal gesendet)')
  pruefe(await bestaetigeOnlineBuchung(o!.id, ECHT_EMAIL) === false, 'zweiter Bestätigungsversuch sendet nichts (idempotent)')
  const { data: nachherSnapshot } = await supabaseAdmin.from('kunden').select('*').in('id', [...vorherKunden]).order('id')
  pruefe(JSON.stringify(vorherSnapshot) === JSON.stringify(nachherSnapshot), 'Bestandskunden unverändert (Name/E-Mail nicht überschrieben)')
  pruefe(vorherKunden.size === 0 || /Online angegeben: Valeriu Test Online, valeriuleo@gmail.com/.test(o?.notizen ?? ''), `Notiz "Online angegeben" (${o?.notizen})`)
  const seite = await fetch(`${BASIS}/buchen/${SLUG}/erfolg?session_id=${o!.stripe_session_id}`)
  pruefe((await seite.text()).includes('Euer Termin ist fix'), 'Erfolgsseite: "Euer Termin ist fix!"')
  const { data: anfragen } = await supabaseAdmin.from('kunden_anfragen').select('id').eq('reservierung_id', o!.id)
  pruefe((anfragen ?? []).length === 0, 'kein "doppelt belegt"-Eintrag (normaler Fall)')

  console.log('\n  Lena-Weg:')
  const { data: l } = await supabaseAdmin.from('reservierungen').select('*').eq('id', lr!.id).single()
  pruefe(l?.status === 'BESTAETIGT_BEZAHLT' && !!l?.stripe_payment_intent_id, 'GRÜN + payment_intent gespeichert (wie bisher)')
  pruefe(l?.bestaetigung_gesendet_am === null, 'bestaetigung_gesendet_am bleibt NULL (Online-Logik nicht beteiligt)')
  const { data: lkNach } = await supabaseAdmin.from('kunden').select('email').eq('id', lk!.id).single()
  const sessionLena = await stripe.checkout.sessions.retrieve(ls.id)
  pruefe(!!lkNach?.email && lkNach.email === sessionLena.customer_details?.email, `E-Mail aus Stripe in Kunde übernommen (${lkNach?.email}) – wie bisher`)

  console.log('\n  Bitte prüfen (Telefon/Postfach):')
  console.log('   • 2 SMS mit "Eure Anzahlung ist eingegangen - der Termin am … ist fix!" (Online + Lena)')
  console.log('   • E-Mail "Buchungsbestätigung" mit termin.ics (Online)')
  console.log('   • E-Mail "Buchungsbestätigung" mit termin.ics (Lena-Weg, weil die E-Mail vorher unbekannt war)')
  console.log('   • E-Mail "Neue Online-Buchung" an STAFF_NOTIFICARE_EMAIL')
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    console.error('Abbruch: STRIPE_SECRET_KEY ist kein Testschlüssel.'); process.exit(1)
  }
  const staff = process.env.STAFF_NOTIFICARE_EMAIL?.trim().toLowerCase() ?? ''
  if (UPSALLA_ADRESSEN.includes(staff)) {
    console.error(`Abbruch: STAFF_NOTIFICARE_EMAIL=${staff} – im Test darf nichts an Upsalla gehen.`); process.exit(1)
  }
  testeValidierung()
  try {
    const ping = await fetch(`${BASIS}/api/buchen/${SLUG}/tag?datum=2000-01-01`).catch(() => null)
    if (!ping || ping.status === 404) {
      console.error(`\nDev-Server unter ${BASIS} nicht erreichbar oder Online-Buchung aus (ONLINE_BUCHUNG_SCHALTER_IGNORIEREN=true gesetzt?).`)
      fehlgeschlagen++
      return
    }
    await testeServer()
    if (MIT_ZAHLUNG) await testeZahlung()
  } finally {
    await aufraeumen()
    console.log(fehlgeschlagen === 0 ? '\nAlle Prüfungen bestanden.' : `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.`)
    process.exit(fehlgeschlagen === 0 ? 0 : 1)
  }
}

main().catch(async e => { console.error(e); await aufraeumen(); process.exit(1) })
