// Test Phase 6: Schutz der Online-Buchung (src/lib/online-buchung/schutz.ts + next.config.ts).
//
//   npx tsx --env-file=.env.local scripts/test-schutz.ts          # A + B (ohne Server)
//   npx tsx --env-file=.env.local scripts/test-schutz.ts --http   # + C (laufender Dev-Server)
//
// A: rein (IP-Hash, Rate-Limit-Entscheidung, IP-Ermittlung)
// B: Turnstile live bei Cloudflare mit den öffentlichen Testschlüsseln
// C: HTTP gegen den Dev-Server: frame-ancestors-Header, Honeypot, Rate-Limit (429 beim 6. Versuch).
//    Nutzt eine nicht existierende Loge → es entsteht keine Buchung. Protokollzeilen werden gelöscht.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { ipHash, rateLimitErlaubt, ermittleIp, pruefeTurnstileToken } from '../src/lib/online-buchung/schutz'
import { buchungsfenster } from '../src/lib/online-buchung/validierung'

const BASIS = process.env.TEST_BASIS_URL ?? 'http://localhost:3000'
const MIT_HTTP = process.argv.includes('--http')

// Öffentliche Cloudflare-Testschlüssel (https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
const SECRET_IMMER_OK = '1x0000000000000000000000000000000AA'
const SECRET_IMMER_FEHLER = '2x0000000000000000000000000000000AA'
const SECRET_SCHON_VERWENDET = '3x0000000000000000000000000000000AA'
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

let fehlgeschlagen = 0
function pruefe(bedingung: boolean, text: string, details?: unknown) {
  if (bedingung) console.log(`  ✓ ${text}`)
  else { fehlgeschlagen++; console.error(`  ✗ ${text}`, details ?? '') }
}

function testeRein() {
  console.log('\nA. Rein')
  const h = ipHash('203.0.113.7', 'salz')
  pruefe(/^[0-9a-f]{64}$/.test(h), 'IP-Hash ist SHA-256 (hex)')
  pruefe(!h.includes('203'), 'IP steht nicht im Hash')
  pruefe(h === ipHash('203.0.113.7', 'salz'), 'gleiche IP + Salt → gleicher Hash')
  pruefe(h !== ipHash('203.0.113.7', 'anderes-salz'), 'anderer Salt → anderer Hash')
  pruefe(h !== ipHash('203.0.113.8', 'salz'), 'andere IP → anderer Hash')
  pruefe(rateLimitErlaubt(0) && rateLimitErlaubt(4), 'Versuche 1–5 erlaubt')
  pruefe(!rateLimitErlaubt(5) && !rateLimitErlaubt(9), 'ab dem 6. Versuch gesperrt')
  pruefe(ermittleIp(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' })) === '1.2.3.4', 'x-real-ip hat Vorrang')
  pruefe(ermittleIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' })) === '5.6.7.8', 'sonst erster x-forwarded-for-Eintrag')
  pruefe(ermittleIp(new Headers()) === 'unbekannt', 'ohne Header → unbekannt')
}

async function testeTurnstile() {
  console.log('\nB. Turnstile (Cloudflare, Testschlüssel)')
  const ok = await pruefeTurnstileToken(DUMMY_TOKEN, SECRET_IMMER_OK)
  pruefe(ok.success === true, 'Testschlüssel „immer ok“ → success', ok)
  const nein = await pruefeTurnstileToken(DUMMY_TOKEN, SECRET_IMMER_FEHLER)
  pruefe(nein.success === false, 'Testschlüssel „immer Fehler“ → abgelehnt', nein)
  const doppelt = await pruefeTurnstileToken(DUMMY_TOKEN, SECRET_SCHON_VERWENDET)
  pruefe(doppelt.success === false && (doppelt['error-codes'] ?? []).includes('timeout-or-duplicate'), 'Testschlüssel „schon verwendet“ → timeout-or-duplicate', doppelt)
}

async function testeHttp() {
  console.log('\nC. HTTP gegen Dev-Server')
  const seite = await fetch(`${BASIS}/buchen/upsalla`)
  const csp = seite.headers.get('content-security-policy') ?? ''
  pruefe(seite.status === 200, `/buchen/upsalla erreichbar (${seite.status})`)
  pruefe(csp.includes("frame-ancestors 'self' https://upsalla-kinderpark.de https://www.upsalla-kinderpark.de"), 'frame-ancestors-Header gesetzt', csp)
  const erfolg = await fetch(`${BASIS}/buchen/upsalla/erfolg`)
  pruefe((erfolg.headers.get('content-security-policy') ?? '').includes('frame-ancestors'), 'Header auch auf /buchen/upsalla/erfolg')
  const dashboard = await fetch(`${BASIS}/auth/login`)
  pruefe(!(dashboard.headers.get('content-security-policy') ?? '').includes('upsalla-kinderpark.de'), 'Staff-Seiten ohne diesen Header')

  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`
  const salt = process.env.IP_HASH_SALT ?? 'dev-salt-nur-lokal'
  const hash = ipHash(ip, salt)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  // Datum mitten im Buchungsfenster, Wochentag
  const d = new Date(buchungsfenster().von + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 14)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  const body = (over: Record<string, unknown> = {}) => JSON.stringify({
    datum: d.toISOString().slice(0, 10), zeitslot: 1, loge_id: '00000000-0000-4000-8000-00000000dead', // existiert nicht
    kinder_anzahl: 8, erwachsene_anzahl: 2, vorname: 'Test', nachname: 'Schutz', telefon: '0000 0000 095', email: 'test-schutz@example.com',
    agb_akzeptiert: true, newsletter_opt_in: false, website: '', turnstile_token: DUMMY_TOKEN, idempotenz_schluessel: randomUUID(), ...over,
  })
  const post = (b: string) => fetch(`${BASIS}/api/buchen/upsalla/reservieren`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': ip }, body: b })

  try {
    const honig = await post(body({ website: 'https://spam.example' }))
    pruefe(honig.status === 400, `Honeypot ausgefüllt → 400 (${honig.status})`)

    const stati: number[] = []
    for (let i = 0; i < 6; i++) stati.push((await post(body())).status)
    pruefe(stati.slice(0, 5).every(s => s === 409), `Versuche 1–5 kommen durch (409 Loge ungültig): ${stati.slice(0, 5).join(',')}`)
    pruefe(stati[5] === 429, `6. Versuch → 429 (${stati[5]})`)
    const r429 = await post(body())
    const j = await r429.json()
    pruefe(r429.status === 429 && typeof j.hinweis === 'string' && j.hinweis.includes('Zu viele'), 'freundlicher Hinweis bei 429', j)

    const { count } = await db.from('online_buchung_versuche').select('id', { count: 'exact', head: true }).eq('ip_hash', hash)
    pruefe(count === 5, `nur erlaubte Versuche protokolliert, nur als Hash (${count})`)
    const { count: klartext } = await db.from('online_buchung_versuche').select('id', { count: 'exact', head: true }).eq('ip_hash', ip)
    pruefe(klartext === 0, 'keine Klartext-IP gespeichert')
  } finally {
    await db.from('online_buchung_versuche').delete().eq('ip_hash', hash)
  }
}

async function main() {
  testeRein()
  await testeTurnstile()
  if (MIT_HTTP) await testeHttp()
  else console.log('\n(C übersprungen — mit --http gegen laufenden Dev-Server)')
  console.log(fehlgeschlagen ? `\n❌ ${fehlgeschlagen} Prüfung(en) fehlgeschlagen` : '\n✅ Alle Prüfungen grün')
  process.exit(fehlgeschlagen ? 1 : 0)
}
void main()
