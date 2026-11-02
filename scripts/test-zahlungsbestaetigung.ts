// Test: Zahlungsbestätigung (Lena-/Personal-Weg) wird nur EINMAL gesendet
// (src/lib/stripe/zahlungsbestaetigung.ts, Migration 013).
//
//   npx tsx --env-file=.env.local scripts/test-zahlungsbestaetigung.ts                    # A (nur DB)
//   npx tsx --env-file=.env.local scripts/test-zahlungsbestaetigung.ts --http=<dev.log>   # + B (Dev-Server)
//
// A: 10 parallele Beanspruchungen derselben bezahlten Reservierung → genau 1 darf senden;
//    unbezahlt → niemand; danach → niemand.
// B: 5 signierte checkout.session.completed-Events gleichzeitig an /api/webhooks/stripe
//    (wie Stripe-Mehrfachzustellung) → alle 200, Status BEZAHLT, genau 1 SMS-Versuch.
//    Gezählt über das Dev-Server-Log (Pfad als Argument). Testkunde mit Fantasienummer
//    (Twilio lehnt ab → keine echte SMS) und bekannter E-Mail (→ keine Bestätigungs-Mail).
// Testdaten im Jahr 2099, werden im finally gelöscht.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BASIS = process.env.TEST_BASIS_URL ?? 'http://localhost:3000'
const STANDORT_ID = '00000000-0000-0000-0000-000000000001'
const HTTP_LOG = process.argv.find(a => a.startsWith('--http='))?.slice(7)

let fehlgeschlagen = 0
function pruefe(bedingung: boolean, text: string, details?: unknown) {
  if (bedingung) console.log(`  ✓ ${text}`)
  else { fehlgeschlagen++; console.error(`  ✗ ${text}`, details ?? '') }
}

const kunden = new Set<string>()
const reservierungen = new Set<string>()

async function legeAn(telefon: string, datum: string): Promise<string> {
  const { data: loge } = await db.from('logen').select('id').eq('standort_id', STANDORT_ID).eq('aktiv', true).limit(1).single()
  const { data: k, error: kErr } = await db.from('kunden').insert({
    standort_id: STANDORT_ID, vorname: 'Test', nachname: 'Idempotenz', telefon, email: 'test-idempotenz@example.com',
    dsgvo_einwilligung: true, newsletter_opt_in: false,
  }).select('id').single()
  if (kErr || !k) throw new Error(`Kunde: ${kErr?.message}`)
  kunden.add(k.id)
  const { data: r, error: rErr } = await db.from('reservierungen').insert({
    standort_id: STANDORT_ID, loge_id: loge!.id, kunde_id: k.id, typ: 'GEBURTSTAG', status: 'BESTAETIGT_AUSSTEHEND',
    datum, zeitslot: 1, kinder_anzahl: 8, erwachsene_anzahl: 2, paket_preis_pro_kind: 23, gesamtbetrag: 184, anzahlung_betrag: 36.8,
    angenommen_von: 'KI LENA', notizen: 'TEST Zahlungsbestätigung einmalig',
  }).select('id').single()
  if (rErr || !r) throw new Error(`Reservierung: ${rErr?.message}`)
  reservierungen.add(r.id)
  return r.id
}

async function testeBeanspruchen() {
  console.log('\nA. Beanspruchen (DB)')
  const { beansprucheZahlungsbestaetigung } = await import('../src/lib/stripe/zahlungsbestaetigung')
  const id = await legeAn('00000000097', '2099-09-07')
  pruefe(await beansprucheZahlungsbestaetigung(id, 'Test') === false, 'unbezahlt → niemand darf senden')
  await db.from('reservierungen').update({ status: 'BESTAETIGT_BEZAHLT' }).eq('id', id)
  const ergebnisse = await Promise.all(Array.from({ length: 10 }, (_, i) => beansprucheZahlungsbestaetigung(id, `Test-${i}`)))
  pruefe(ergebnisse.filter(Boolean).length === 1, `10 gleichzeitige Versuche → genau 1 darf senden (${ergebnisse.filter(Boolean).length})`)
  pruefe(await beansprucheZahlungsbestaetigung(id, 'Test-spaet') === false, 'späterer Versuch → nichts')
  const { data } = await db.from('reservierungen').select('bestaetigung_gesendet_am').eq('id', id).single()
  pruefe(!!data?.bestaetigung_gesendet_am, 'bestaetigung_gesendet_am gesetzt')
}

async function testeWebhook(logPfad: string) {
  console.log('\nB. Webhook 5× gleichzeitig (Dev-Server)')
  const secret = process.env.STRIPE_WEBHOOK_SECRET!
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const telefon = '00000000096'
  const id = await legeAn(telefon, '2099-09-08')
  const logVorher = readFileSync(logPfad, 'utf8').length

  const payload = JSON.stringify({
    id: `evt_test_idempotenz_${Date.now()}`, object: 'event', type: 'checkout.session.completed', created: Math.floor(Date.now() / 1000),
    api_version: '2026-06-24.dahlia', livemode: false, pending_webhooks: 1, request: { id: null, idempotency_key: null },
    data: { object: {
      id: `cs_test_idempotenz${Date.now()}`, object: 'checkout.session', payment_status: 'paid', status: 'complete',
      payment_intent: 'pi_test_idempotenz', metadata: { reservierung_id: id },
      customer_details: { email: 'test-idempotenz@example.com' },
    } },
  })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret })
  const antworten = await Promise.all(Array.from({ length: 5 }, () => fetch(`${BASIS}/api/webhooks/stripe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': header }, body: payload,
  })))
  pruefe(antworten.every(a => a.status === 200), `alle 5 Zustellungen → 200 (${antworten.map(a => a.status).join(',')})`)

  await new Promise(r => setTimeout(r, 3000))
  const { data } = await db.from('reservierungen').select('status, stripe_payment_intent_id, bestaetigung_gesendet_am').eq('id', id).single()
  pruefe(data?.status === 'BESTAETIGT_BEZAHLT' && data?.stripe_payment_intent_id === 'pi_test_idempotenz', 'Status BEZAHLT + payment_intent (wie bisher)')
  pruefe(!!data?.bestaetigung_gesendet_am, 'bestaetigung_gesendet_am gesetzt')

  const neu = readFileSync(logPfad, 'utf8').slice(logVorher)
  const smsVersuche = (neu.match(/\[Twilio\] SMS-Fehler/g) ?? []).length
  const uebersprungen = (neu.match(new RegExp(`\\[Zahlungsbestätigung\\] ${id} schon bestätigt – Webhook`, 'g')) ?? []).length
  pruefe(smsVersuche === 1, `genau 1 SMS-Versuch (Twilio lehnt die Fantasienummer ab): ${smsVersuche}`)
  pruefe(uebersprungen === 4, `4 Zustellungen ohne Versand: ${uebersprungen}`)
}

async function main() {
  try {
    await testeBeanspruchen()
    if (HTTP_LOG) await testeWebhook(HTTP_LOG)
    else console.log('\n(B übersprungen — mit --http=<Pfad zum Dev-Server-Log>)')
  } finally {
    if (reservierungen.size) await db.from('reservierungen').delete().in('id', [...reservierungen])
    if (kunden.size) await db.from('kunden').delete().in('id', [...kunden])
  }
  console.log(fehlgeschlagen ? `\n❌ ${fehlgeschlagen} Prüfung(en) fehlgeschlagen` : '\n✅ Alle Prüfungen grün')
  process.exit(fehlgeschlagen ? 1 : 0)
}
void main()
