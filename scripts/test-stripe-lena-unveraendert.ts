// Beweist, dass Phase 4 (Online-Buchung) den Stripe-Weg von Lena/Personal NICHT verändert.
//
// 1. Lädt die ALTE src/lib/stripe/client.ts aus Git (Commit vor Phase 4) und die neue, ruft in
//    beiden erstelleAnzahlungsSession mit identischen Eingaben auf (Stripe-Aufruf abgefangen,
//    Zeit eingefroren) und vergleicht die an Stripe übergebenen Parameter exakt.
// 2. Erstellt eine echte Session im Stripe-TESTMODUS im Lena-Stil und prüft 24h-Gültigkeit,
//    Metadaten (nur reservierung_id) und URLs. Danach wird die Session verfallen gelassen.
// 3. Prüft, dass der SMS-Text der Online-Bestätigung zeichengenau dem Text im Stripe-Webhook
//    (Lena-Weg) und im Cron stripe-abgleich entspricht.
// 4. Prüft die Online-Optionen (30 Min., quelle=ONLINE, reservierung_id nicht überschreibbar).
//
// Aufruf: npx tsx --env-file=.env.local scripts/test-stripe-lena-unveraendert.ts

import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import path from 'node:path'

const REFERENZ_COMMIT = '167f2e1' // letzter Commit vor Phase 4
const ALT_DATEI = path.join(__dirname, '.alt-stripe-client.tmp.ts')

let fehlgeschlagen = 0
function pruefe(bedingung: boolean, text: string, details?: unknown) {
  if (bedingung) console.log(`  ✓ ${text}`)
  else { fehlgeschlagen++; console.error(`  ✗ ${text}`, details ?? '') }
}

type Modul = typeof import('../src/lib/stripe/client')

// Fängt den Stripe-Aufruf ab und gibt die übergebenen Parameter zurück
async function erfasseParameter(modul: Modul, params: Parameters<Modul['erstelleAnzahlungsSession']>[0]): Promise<unknown> {
  let erfasst: unknown = null
  const sessions = modul.stripe.checkout.sessions as unknown as { create: (p: unknown) => Promise<unknown> }
  const original = sessions.create
  sessions.create = async (p: unknown) => { erfasst = p; return { url: 'https://checkout.stripe.test/x', id: 'cs_test_x' } }
  try {
    await modul.erstelleAnzahlungsSession(params)
  } finally {
    sessions.create = original
  }
  return erfasst
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    console.error('Abbruch: STRIPE_SECRET_KEY ist kein Testschlüssel (sk_test_...).')
    process.exit(1)
  }

  // ── 1. Alt vs. neu ────────────────────────────────────────────────────────────
  console.log(`\n1. Parameter an Stripe: alte Version (${REFERENZ_COMMIT}) vs. neue Version`)
  writeFileSync(ALT_DATEI, execSync(`git show ${REFERENZ_COMMIT}:src/lib/stripe/client.ts`, { encoding: 'utf8' }))
  const echtesNow = Date.now
  try {
    const alt: Modul = await import(ALT_DATEI)
    const neu: Modul = await import('../src/lib/stripe/client')
    Date.now = () => 1_800_000_000_000

    // Die vier Aufrufformen im Code (Lena reservierungen, zahlungslink-erneut, Personal, Erinnerungs-Cron)
    const faelle: Array<[string, Parameters<Modul['erstelleAnzahlungsSession']>[0]]> = [
      ['Lena mit E-Mail', { betragCent: 3312, reservierungId: '11111111-1111-1111-1111-111111111111', beschreibung: 'Anzahlung Geburtstag Upsalla – Samstag, 14.11.2026 (10:30-14:30)', kundenEmail: 'a@b.de' }],
      ['Lena ohne E-Mail (undefined)', { betragCent: 2760, reservierungId: '22222222-2222-2222-2222-222222222222', beschreibung: 'Anzahlung Geburtstag Upsalla – Mittwoch, 18.11.2026 (15:00-19:00)', kundenEmail: undefined }],
      ['zahlungslink-erneut / Personal', { betragCent: 4140, reservierungId: '33333333-3333-3333-3333-333333333333', beschreibung: 'Anzahlung Geburtstag Upsalla' }],
      ['Erinnerungs-Cron', { betragCent: 3312, reservierungId: '44444444-4444-4444-4444-444444444444', beschreibung: 'Anzahlung Geburtstag Upsalla – Samstag, 14.11.2026', kundenEmail: 'x@y.de' }],
    ]
    for (const [name, p] of faelle) {
      const a = await erfasseParameter(alt, p)
      const n = await erfasseParameter(neu, p)
      pruefe(a !== null && isDeepStrictEqual(a, n), `${name}: identisch`, { alt: a, neu: n })
      // Auch die Schlüsselreihenfolge (JSON) ist gleich
      pruefe(JSON.stringify(a) === JSON.stringify(n), `${name}: JSON byte-gleich`)
      pruefe(n !== null && !('payment_method_types' in (n as object)), `${name}: kein payment_method_types (Dashboard entscheidet wie bisher)`)
    }

    // Fallback auf NEXT_PUBLIC_APP_URL, wenn APP_URL fehlt
    const appUrl = process.env.APP_URL
    delete process.env.APP_URL
    const a = await erfasseParameter(alt, faelle[0][1])
    const n = await erfasseParameter(neu, faelle[0][1])
    pruefe(isDeepStrictEqual(a, n), 'ohne APP_URL (Fallback NEXT_PUBLIC_APP_URL): identisch')
    process.env.APP_URL = appUrl

    const p = n as { expires_at: number; metadata: Record<string, string>; success_url: string; cancel_url: string }
    pruefe(p.expires_at - 1_800_000_000 === 86400, 'Gültigkeit 24h (86400 s)')
    pruefe(isDeepStrictEqual(Object.keys(p.metadata), ['reservierung_id']), 'Metadaten nur reservierung_id (kein quelle)')

    // ── 4. Online-Optionen ─────────────────────────────────────────────────────
    console.log('\n4. Online-Optionen')
    const o = neu.baueAnzahlungsSessionParameter({
      ...faelle[0][1], gueltigkeitSekunden: 1800,
      successUrl: 'http://localhost:3000/buchen/upsalla/erfolg?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:3000/buchen/upsalla/abgebrochen?session_id={CHECKOUT_SESSION_ID}',
      zusatzMetadata: { quelle: 'ONLINE', reservierung_id: 'boese' },
    }, 1_800_000_000_000)
    pruefe(o.expires_at === 1_800_000_000 + 1800, 'Online: 30 Minuten')
    pruefe(o.metadata?.quelle === 'ONLINE', 'Online: metadata.quelle = ONLINE')
    pruefe(o.metadata?.reservierung_id === faelle[0][1].reservierungId, 'reservierung_id nicht überschreibbar')
    pruefe(o.success_url!.includes('/buchen/upsalla/erfolg') && o.cancel_url!.includes('/buchen/upsalla/abgebrochen'), 'Online: eigene success/cancel URLs')
    pruefe(isDeepStrictEqual(o.custom_text, (n as { custom_text: unknown }).custom_text), 'Online: gleiche Stornierungsbedingungen wie Lena')
    const mitZahlarten = neu.baueAnzahlungsSessionParameter({ ...faelle[0][1], zahlungsarten: ['card', 'klarna'] }, 1_800_000_000_000)
    pruefe(isDeepStrictEqual(mitZahlarten.payment_method_types, ['card', 'klarna']), 'Online: payment_method_types wird nur mit Option gesetzt')

    const { waehleSofortZahlarten } = await import('../src/lib/stripe/zahlungsarten')
    pruefe(isDeepStrictEqual(waehleSofortZahlarten(new Set()), ['card']), 'Zahlarten: ohne PayPal/Klarna → nur card')
    pruefe(isDeepStrictEqual(waehleSofortZahlarten(new Set(['klarna', 'sepa_debit', 'paypal'])), ['card', 'paypal', 'klarna']), 'Zahlarten: SEPA wird nie übernommen, PayPal/Klarna nur wenn aktiv')
  } finally {
    Date.now = echtesNow
    try { unlinkSync(ALT_DATEI) } catch { /* schon weg */ }
  }

  // ── 2. Echte Session im Testmodus ─────────────────────────────────────────────
  console.log('\n2. Echte Stripe-Session (Testmodus) im Lena-Stil')
  const { stripe, erstelleAnzahlungsSession } = await import('../src/lib/stripe/client')
  const s = await erstelleAnzahlungsSession({ betragCent: 3312, reservierungId: '00000000-0000-0000-0000-0000000000aa', beschreibung: 'TEST Lena-Weg (Phase 4)', kundenEmail: 'valeriuleo@gmail.com' })
  try {
    const geladen = await stripe.checkout.sessions.retrieve(s.id)
    const dauer = geladen.expires_at - geladen.created
    pruefe(geladen.livemode === false, 'livemode = false (Testmodus)')
    pruefe(dauer >= 86395 && dauer <= 86405, `expires_at - created = ${dauer} s (≈ 86400)`)
    pruefe(isDeepStrictEqual(Object.keys(geladen.metadata ?? {}), ['reservierung_id']), 'Metadaten nur reservierung_id')
    const basis = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
    pruefe(geladen.success_url === `${basis}/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`, `success_url = ${geladen.success_url}`)
    pruefe(geladen.cancel_url === `${basis}/zahlung/abgebrochen`, `cancel_url = ${geladen.cancel_url}`)
  } finally {
    await stripe.checkout.sessions.expire(s.id).catch(() => undefined)
  }

  // ── 3. SMS-Text ───────────────────────────────────────────────────────────────
  console.log('\n3. SMS-Text Zahlungsbestätigung')
  const vorlage = (datei: string, marker: string): string | null => {
    const quelle = readFileSync(path.join(__dirname, '..', datei), 'utf8')
    const zeile = quelle.split('\n').find(z => z.includes(marker) && z.includes('`'))
    if (!zeile) return null
    const m = zeile.match(/`([^`]*)`/)
    return m ? m[1].replace(/\$\{(kunde|p)\./g, '${') : null
  }
  const MARKER = 'Eure Anzahlung ist eingegangen - der Termin am'
  const webhook = vorlage('src/app/api/webhooks/stripe/route.ts', MARKER)
  const abgleich = vorlage('src/app/api/cron/stripe-abgleich/route.ts', MARKER)
  // Online-Text ohne den optionalen Zusatz für „ganze Loge“ (Modul 10) muss gleich bleiben
  const online = vorlage('src/lib/online-buchung/bestaetigung.ts', MARKER)?.replace("${ganzeLoge ? SMS_ZUSATZ_GANZE_LOGE : ''}", '') ?? null
  pruefe(!!webhook && webhook === online, 'Online-Text = Webhook-Text (Lena)', { webhook, online })
  pruefe(!!abgleich && abgleich === online, 'Online-Text = Cron-stripe-abgleich-Text', { abgleich, online })
  const { zahlungsbestaetigungSmsText } = await import('../src/lib/online-buchung/bestaetigung')
  const beispiel = zahlungsbestaetigungSmsText({ vorname: 'Anna', datumAnzeige: 'Samstag, 14.11.2026', start: '10:30', ende: '14:30', restbetrag: '132.48' })
  pruefe(!/[–—]/.test(beispiel), 'kein Gedanken-/Halbgeviertstrich (GSM-7)')
  pruefe(zahlungsbestaetigungSmsText({ vorname: 'Anna', datumAnzeige: 'Samstag, 14.11.2026', start: '10:30', ende: '14:30', restbetrag: '132.48', ganzeLoge: false }) === beispiel,
    'ohne ganze Loge: Text unverändert')
  const mitGanz = zahlungsbestaetigungSmsText({ vorname: 'Anna', datumAnzeige: 'Samstag, 14.11.2026', start: '10:30', ende: '14:30', restbetrag: '132.48', ganzeLoge: true })
  // GSM-7-Grundzeichensatz (inkl. äöüÄÖÜß) + € (Erweiterung) — sonst UCS-2 und doppelte Kosten
  const GSM7 = /^[A-Za-z0-9 @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà€]*$/
  pruefe(GSM7.test(mitGanz) && mitGanz.includes(' ist fix! Ganze Loge für euch. Restbetrag'), 'mit ganzer Loge: kurzer Zusatz, nur GSM-7', mitGanz)

  console.log(fehlgeschlagen === 0 ? '\nAlle Prüfungen bestanden.' : `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen.`)
  process.exit(fehlgeschlagen === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); try { unlinkSync(ALT_DATEI) } catch { /* */ } process.exit(1) })
