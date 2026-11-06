// Test Modul „Ganze Loge reservieren“ (docs/module/online-buchung.md, Abschnitt 10).
// Braucht einen laufenden Dev-Server dieses Branches (Stripe-TESTMODUS) und Migration 014.
//
//   npx tsx --env-file=.env.local scripts/test-ganze-loge.ts
//
// A. Werktag, leere Loge: 7 Kinder + 1 Erw. + ganze Loge → OK, ganze_loge = true, 230 € (10 Kinder)
//    danach auf derselben Loge/Slot alles abgelehnt: online, Lena (anlegen + verschieben), Personal;
//    Widget und Lena zeigen die Loge nicht mehr an.
// B. Ganze Loge auf halb belegter Loge → abgelehnt (online + Personal); Lena verschiebt eine
//    „ganze Loge“-Reservierung nicht in einen belegten Slot.
// C. Ganze Loge mit 12 Kindern bzw. im BBQ Zelt → ignoriert (false, normaler Preis).
// D. Preis des Tages: Samstag → 270 €, Ferien-/Feiertag unter der Woche → 270 €.
//
// Echte Termine im Buchungsfenster (wie test-online-reservieren.ts), weit in der Zukunft, freie
// Logen. Alle Testdaten (Reservierungen, Testkunden) werden im finally gelöscht.

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { buchungsfenster } from '../src/lib/online-buchung/validierung'
import { pruefePersonalBelegung } from '../src/lib/utils/belegung'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BASIS = process.env.TEST_BASIS_URL ?? 'http://localhost:3000'
const SLUG = 'upsalla'
const STANDORT_ID = '00000000-0000-0000-0000-000000000001'
const TEST_TELEFONE = ['00000000141', '00000000142', '00000000143', '00000000144']
const LENA_HEADERS = { 'Content-Type': 'application/json', 'x-api-key': process.env.LENA_API_KEY! }

let fehlgeschlagen = 0
function pruefe(bedingung: boolean, text: string, details?: unknown) {
  if (bedingung) console.log(`  ✓ ${text}`)
  else { fehlgeschlagen++; console.error(`  ✗ ${text}`, details ?? '') }
}

const reservierungen = new Set<string>()

// ─── Hilfen ─────────────────────────────────────────────────────────────────────

function plusTage(datum: string, tage: number): string {
  const [j, m, t] = datum.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10)
}

interface TagLoge { loge_id: string; name: string; ist_babywelt: boolean; max_kinder: number; geteilt: boolean; flexibel: boolean }
interface TagAntwort { buchbar: boolean; wochenendpreis?: boolean; slots: Array<{ zeitslot: number; logen: TagLoge[] }> }

async function ladeTag(datum: string): Promise<TagAntwort> {
  const r = await fetch(`${BASIS}/api/buchen/${SLUG}/tag?datum=${datum}`)
  return r.json() as Promise<TagAntwort>
}

function freieNormaleLogen(tag: TagAntwort, zeitslot = 1): TagLoge[] {
  return tag.slots?.find(s => s.zeitslot === zeitslot)?.logen.filter(l => !l.ist_babywelt && !l.flexibel && !l.geteilt && l.max_kinder >= 16) ?? []
}

// Sucht rückwärts ab Fensterende einen Tag, der die Bedingung erfüllt und genug freie Logen hat
async function findeTag(bedingung: (datum: string, tag: TagAntwort) => boolean, mindestLogen: number, ausschluss: string[] = []): Promise<{ datum: string; tag: TagAntwort }> {
  const { bis } = buchungsfenster()
  for (let d = plusTage(bis, -20); d > plusTage(bis, -170); d = plusTage(d, -1)) {
    if (ausschluss.includes(d)) continue
    const tag = await ladeTag(d)
    if (!tag.buchbar || !bedingung(d, tag)) continue
    if (freieNormaleLogen(tag).length >= mindestLogen) return { datum: d, tag }
  }
  throw new Error('Kein passender Testtag gefunden')
}

const wochentag = (d: string) => new Date(d + 'T00:00:00').getDay()

interface Antwort { status: number; body: { checkout_url?: string; grund?: string; hinweis?: string; feld?: string } }

async function reservieren(daten: Record<string, unknown>): Promise<Antwort> {
  const testIp = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`
  const r = await fetch(`${BASIS}/api/buchen/${SLUG}/reservieren`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': testIp }, body: JSON.stringify(daten),
  })
  return { status: r.status, body: await r.json() }
}

function buchung(over: Record<string, unknown>): Record<string, unknown> {
  return {
    zeitslot: 1, erwachsene_anzahl: 1,
    vorname: 'Test', nachname: 'Ganze Loge', telefon: TEST_TELEFONE[0], email: 'test-ganze-loge@example.com',
    agb_akzeptiert: true, website: '', turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX', idempotenz_schluessel: randomUUID(),
    ...over,
  }
}

interface ResZeile { id: string; ganze_loge: boolean; kinder_anzahl: number; gesamtbetrag: number; anzahlung_betrag: number; loge_id: string; datum: string; zeitslot: number }

async function ladeReservierung(schluessel: unknown): Promise<ResZeile | null> {
  const { data } = await db.from('reservierungen').select('id, ganze_loge, kinder_anzahl, gesamtbetrag, anzahlung_betrag, loge_id, datum, zeitslot')
    .eq('idempotenz_schluessel', String(schluessel)).maybeSingle()
  if (data) reservierungen.add(data.id)
  return data as ResZeile | null
}

async function online(over: Record<string, unknown>): Promise<{ antwort: Antwort; res: ResZeile | null }> {
  const daten = buchung(over)
  const antwort = await reservieren(daten)
  return { antwort, res: await ladeReservierung(daten.idempotenz_schluessel) }
}

async function aktiveImSlot(logeId: string, datum: string, zeitslot = 1) {
  const { data } = await db.from('reservierungen').select('id, kinder_anzahl, ganze_loge')
    .eq('loge_id', logeId).eq('datum', datum).eq('zeitslot', zeitslot).neq('status', 'STORNIERT')
  return data ?? []
}

async function lena(pfad: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch(`${BASIS}/api/lena/${pfad}`, { method: 'POST', headers: LENA_HEADERS, body: JSON.stringify({ args: body }) })
  return r.json() as Promise<Record<string, unknown>>
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const werktag = await findeTag((d, t) => wochentag(d) >= 2 && wochentag(d) <= 4 && t.wochenendpreis === false, 3)
    const [L, M, N] = freieNormaleLogen(werktag.tag)
    const W = werktag.datum
    console.log(`Werktag ${W}: L=${L.name}, M=${M.name}, N=${N.name}`)
    pruefe(werktag.tag.slots.every(s => s.logen.every(l => typeof l.flexibel === 'boolean')), 'Tages-API liefert flexibel pro Loge')

    // ── A ──
    console.log('\nA. 7 Kinder + ganze Loge auf leerer Loge')
    const a = await online({ datum: W, loge_id: L.loge_id, kinder_anzahl: 7, ganze_loge: true })
    pruefe(a.antwort.status === 200 && !!a.antwort.body.checkout_url, 'online → 200 mit Checkout-Link', a.antwort)
    pruefe(a.res?.ganze_loge === true, 'ganze_loge = true gespeichert')
    pruefe(a.res?.kinder_anzahl === 7, 'kinder_anzahl bleibt 7 (echte Zahl)')
    pruefe(Number(a.res?.gesamtbetrag) === 230 && Number(a.res?.anzahlung_betrag) === 46, `Werktag: 10 × 23 € = 230 €, Anzahlung 46 € (${a.res?.gesamtbetrag} / ${a.res?.anzahlung_betrag})`)

    const tagNach = await ladeTag(W)
    pruefe(!tagNach.slots.find(s => s.zeitslot === 1)?.logen.some(l => l.loge_id === L.loge_id), 'Widget zeigt die Loge im Slot nicht mehr an')
    const lv = await fetch(`${BASIS}/api/lena/verfuegbarkeit`, { method: 'POST', headers: LENA_HEADERS, body: JSON.stringify({ args: { datum: W } }) })
    const lvBody = await lv.json() as { verfuegbar: Array<{ loge_id: string; zeitslot: number }> }
    pruefe(!lvBody.verfuegbar.some(v => v.loge_id === L.loge_id && v.zeitslot === 1), 'Lena-Verfügbarkeit zeigt die Loge im Slot nicht mehr an')

    const a2 = await online({ datum: W, loge_id: L.loge_id, kinder_anzahl: 3, telefon: TEST_TELEFONE[1] })
    pruefe(a2.antwort.status === 409 && a2.antwort.body.grund === 'SLOT_BELEGT' && !a2.res, 'weitere Online-Buchung (3 Kinder) → 409 SLOT_BELEGT', a2.antwort)

    const lenaNeu = await lena('reservierungen', {
      datum: W, loge_id: L.loge_id, zeitslot: 1, typ: 'GEBURTSTAG', kinder_anzahl: 5, erwachsene_anzahl: 2,
      vorname: 'Test', nachname: 'Ganze Loge Lena', telefon: TEST_TELEFONE[2],
    })
    pruefe(String(lenaNeu.hinweis ?? '').includes('exklusiv belegt'), 'Lena anlegen (5 Kinder) → abgelehnt „exklusiv belegt“', lenaNeu)
    pruefe((await aktiveImSlot(L.loge_id, W)).length === 1, 'im Slot weiterhin nur die eine Reservierung')

    // Lena verschiebt eine andere Reservierung (Testdatensatz 2099) in den Slot → abgelehnt
    const { data: kunde } = await db.from('kunden').insert({
      standort_id: STANDORT_ID, vorname: 'Test', nachname: 'Ganze Loge Verschieben', telefon: TEST_TELEFONE[3], dsgvo_einwilligung: true, newsletter_opt_in: false,
    }).select('id').single()
    const { data: r2 } = await db.from('reservierungen').insert({
      standort_id: STANDORT_ID, loge_id: N.loge_id, kunde_id: kunde!.id, typ: 'GEBURTSTAG', status: 'BESTAETIGT_AUSSTEHEND',
      datum: '2099-11-04', zeitslot: 1, kinder_anzahl: 3, erwachsene_anzahl: 2, paket_preis_pro_kind: 23, gesamtbetrag: 138, anzahlung_betrag: 27.6,
      angenommen_von: 'KI LENA', notizen: 'TEST Ganze Loge',
    }).select('id').single()
    reservierungen.add(r2!.id)
    const verschieben = await lena('reservierungen/aendern', { id: r2!.id, datum: W, zeitslot: 1, loge_id: L.loge_id })
    pruefe(String(verschieben.hinweis ?? '').includes('exklusiv belegt'), 'Lena verschieben in den Slot → abgelehnt „exklusiv belegt“', verschieben)
    const { data: r2nach } = await db.from('reservierungen').select('datum, loge_id').eq('id', r2!.id).single()
    pruefe(r2nach?.datum === '2099-11-04' && r2nach?.loge_id === N.loge_id, 'verschobene Reservierung unverändert')

    const personal = pruefePersonalBelegung(await aktiveImSlot(L.loge_id, W), { kinderAnzahl: 3, ganzeLoge: false, flexibel: false, maxKinder: 16 })
    pruefe(personal === 'Diese Loge ist für diesen Slot exklusiv belegt (ganze Loge gebucht).', 'Personal (3 Kinder) → abgelehnt', personal)

    // ── B ──
    console.log('\nB. Ganze Loge auf halb belegter Loge')
    const b1 = await online({ datum: W, loge_id: M.loge_id, kinder_anzahl: 4, telefon: TEST_TELEFONE[1] })
    pruefe(b1.antwort.status === 200 && b1.res?.ganze_loge === false, 'erste Gruppe (4 Kinder, ohne ganze Loge) → 200', b1.antwort)
    const b2 = await online({ datum: W, loge_id: M.loge_id, kinder_anzahl: 5, ganze_loge: true })
    pruefe(b2.antwort.status === 409 && b2.antwort.body.grund === 'SLOT_BELEGT' && String(b2.antwort.body.hinweis).startsWith('Die ganze Loge ist zu dieser Zeit nicht mehr frei') && !b2.res,
      'ganze Loge (5 Kinder) → 409 mit Hinweis „Die ganze Loge … nicht mehr frei“', b2.antwort)
    const personalB = pruefePersonalBelegung(await aktiveImSlot(M.loge_id, W), { kinderAnzahl: 5, ganzeLoge: true, flexibel: false, maxKinder: 16 })
    pruefe(personalB === 'Ganze Loge nicht möglich: In diesem Slot feiert schon eine andere Gruppe.', 'Personal mit ganzer Loge → abgelehnt', personalB)
    pruefe(pruefePersonalBelegung(await aktiveImSlot(M.loge_id, W), { kinderAnzahl: 5, ganzeLoge: false, flexibel: false, maxKinder: 16 }) === null,
      'Personal ohne ganze Loge (5 Kinder) → weiterhin möglich (wie bisher)')
    const verschiebenGanz = await lena('reservierungen/aendern', { id: a.res!.id, loge_id: M.loge_id })
    pruefe(String(verschiebenGanz.hinweis ?? '').includes('ganze Loge gebucht'), 'Lena verschiebt „ganze Loge“-Reservierung nicht in belegten Slot', verschiebenGanz)

    // ── C ──
    console.log('\nC. Ganze Loge wird ignoriert, wo sie nichts ändert')
    const c1 = await online({ datum: W, loge_id: N.loge_id, kinder_anzahl: 12, ganze_loge: true, telefon: TEST_TELEFONE[1] })
    pruefe(c1.antwort.status === 200 && c1.res?.ganze_loge === false && Number(c1.res?.gesamtbetrag) === 276,
      `12 Kinder + ganze Loge → gespeichert false, 12 × 23 = 276 € (${c1.res?.gesamtbetrag})`, c1.antwort)
    const bbq = werktag.tag.slots.find(s => s.zeitslot === 1)?.logen.find(l => l.flexibel)
    if (bbq) {
      const c2 = await online({ datum: W, loge_id: bbq.loge_id, kinder_anzahl: 7, ganze_loge: true, telefon: TEST_TELEFONE[1] })
      pruefe(c2.antwort.status === 200 && c2.res?.ganze_loge === false && Number(c2.res?.gesamtbetrag) === 161,
        `${bbq.name} (7 Kinder) + ganze Loge → gespeichert false, 7 × 23 = 161 € (${c2.res?.gesamtbetrag})`, c2.antwort)
    } else {
      console.log('  (BBQ Zelt an diesem Tag nicht frei – Fall übersprungen)')
    }

    // ── D ──
    console.log('\nD. Preis des Tages')
    const samstag = await findeTag(d => wochentag(d) === 6, 1, [W])
    const sa = await online({ datum: samstag.datum, loge_id: freieNormaleLogen(samstag.tag)[0].loge_id, kinder_anzahl: 7, ganze_loge: true })
    pruefe(sa.antwort.status === 200 && Number(sa.res?.gesamtbetrag) === 270 && sa.res?.ganze_loge === true,
      `Samstag ${samstag.datum}: 10 × 27 € = 270 € (${sa.res?.gesamtbetrag})`, sa.antwort)

    const ferientag = await findeTag((d, t) => wochentag(d) >= 1 && wochentag(d) <= 5 && t.wochenendpreis === true, 1, [W, samstag.datum])
    const fe = await online({ datum: ferientag.datum, loge_id: freieNormaleLogen(ferientag.tag)[0].loge_id, kinder_anzahl: 7, ganze_loge: true })
    pruefe(fe.antwort.status === 200 && Number(fe.res?.gesamtbetrag) === 270 && fe.res?.ganze_loge === true,
      `Ferien-/Feiertag unter der Woche ${ferientag.datum} (${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][wochentag(ferientag.datum)]}): 270 € (${fe.res?.gesamtbetrag})`, fe.antwort)
  } finally {
    // Testkunden: nur die mit Nachname „Ganze Loge…“ (Bestandskunden werden nie gelöscht)
    const ids = [...reservierungen]
    const { data: zeilen } = ids.length ? await db.from('reservierungen').select('kunde_id').in('id', ids) : { data: [] }
    const kundenIds = [...new Set((zeilen ?? []).map(z => z.kunde_id as string))]
    const { data: testKunden } = await db.from('kunden').select('id').in('id', kundenIds.length ? kundenIds : ['00000000-0000-0000-0000-000000000000']).like('nachname', 'Ganze Loge%')
    if (ids.length) {
      await db.from('kunden_anfragen').delete().in('reservierung_id', ids)
      const { error } = await db.from('reservierungen').delete().in('id', ids)
      if (error) console.error('Aufräumen Reservierungen fehlgeschlagen:', error.message)
    }
    const loeschen = (testKunden ?? []).map(k => k.id)
    if (loeschen.length) {
      const { error } = await db.from('kunden').delete().in('id', loeschen)
      if (error) console.error('Aufräumen Kunden fehlgeschlagen:', error.message)
    }
  }
  console.log(fehlgeschlagen ? `\n❌ ${fehlgeschlagen} Prüfung(en) fehlgeschlagen` : '\n✅ Alle Prüfungen grün')
  process.exit(fehlgeschlagen ? 1 : 0)
}
void main()
