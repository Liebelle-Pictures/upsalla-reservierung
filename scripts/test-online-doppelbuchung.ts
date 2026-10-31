// Nebenläufigkeitstest für reserviere_online (Migration 011).
// Feuert parallele RPC-Aufrufe auf dieselbe Loge/Datum/Slot und prüft, dass genau so viele
// Buchungen durchgehen, wie die Kapazitätsregeln erlauben. Läuft auf Testdaten im Juli 2099
// und räumt am Ende (und vorher) alles wieder auf.
//
// Aufruf: npx tsx --env-file=.env.local scripts/test-online-doppelbuchung.ts

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const STANDORT_ID = '00000000-0000-0000-0000-000000000001'
const TEST_TELEFON = '00000000091'
const TEST_VON = '2099-07-01'
const TEST_BIS = '2099-07-31'

interface RpcErgebnis { id?: string; fehler?: string; hinweis?: string; wiederholt?: boolean }

let kundeId = ''
let fehlgeschlagen = 0

async function aufraeumen() {
  const { data: kunde } = await supabaseAdmin.from('kunden').select('id').eq('telefon', TEST_TELEFON).maybeSingle()
  if (kunde) {
    const { error: e1 } = await supabaseAdmin.from('reservierungen').delete().eq('kunde_id', kunde.id).gte('datum', TEST_VON).lte('datum', TEST_BIS)
    if (e1) console.error('Aufräumen Reservierungen fehlgeschlagen:', e1.message)
    const { error: e2 } = await supabaseAdmin.from('kunden').delete().eq('id', kunde.id)
    if (e2) console.error('Aufräumen Kunde fehlgeschlagen:', e2.message)
  }
}

async function logeId(name: string): Promise<string> {
  const { data } = await supabaseAdmin.from('logen').select('id').eq('name', name).single()
  if (!data) throw new Error(`Loge "${name}" nicht gefunden`)
  return data.id
}

function reserviere(logeId: string, datum: string, kinder: number, schluessel = randomUUID()) {
  return supabaseAdmin.rpc('reserviere_online', {
    p_standort_id: STANDORT_ID,
    p_loge_id: logeId,
    p_kunde_id: kundeId,
    p_datum: datum,
    p_zeitslot: 1,
    p_kinder_anzahl: kinder,
    p_erwachsene_anzahl: 2,
    p_paket_preis_pro_kind: 23,
    p_gesamtbetrag: 138,
    p_anzahlung_betrag: 27.6,
    p_notizen: 'TEST reserviere_online',
    p_idempotenz_schluessel: schluessel,
    p_hold_minuten: 35,
  })
}

async function parallel(anzahl: number, aufruf: () => ReturnType<typeof reserviere>) {
  const antworten = await Promise.all(Array.from({ length: anzahl }, aufruf))
  const ergebnisse = antworten.map(a => {
    if (a.error) throw new Error(`RPC-Fehler: ${a.error.message}`)
    return a.data as RpcErgebnis
  })
  return { ok: ergebnisse.filter(e => e.id), abgelehnt: ergebnisse.filter(e => e.fehler) }
}

function pruefe(name: string, bedingung: boolean, details: string) {
  console.log(`${bedingung ? '✓' : '✗'} ${name} — ${details}`)
  if (!bedingung) fehlgeschlagen++
}

async function main() {
  await aufraeumen()

  const { data: kunde, error } = await supabaseAdmin
    .from('kunden')
    .insert({ standort_id: STANDORT_ID, vorname: 'TEST', nachname: 'OnlineDoppelbuchung', telefon: TEST_TELEFON, dsgvo_einwilligung: true })
    .select('id').single()
  if (error || !kunde) throw new Error(`Testkunde: ${error?.message}`)
  kundeId = kunde.id

  const einhorn = await logeId('Einhorn Schloss')   // max 16, normal
  const bbq = await logeId('BBQ Zelt')              // flexibel, max 20
  const gruppen = await logeId('Gruppen')           // online_buchbar = false

  // 1) Exklusive Gruppe: 20 × 12 Kinder → genau 1
  let r = await parallel(20, () => reserviere(einhorn, '2099-07-01', 12))
  pruefe('20 × 12 Kinder', r.ok.length === 1, `${r.ok.length} gebucht, ${r.abgelehnt.length} abgelehnt`)

  // 2) Doppelbelegung: 20 × 6 Kinder → genau 2 (6 + 6 ≤ 16, max 2 Gruppen)
  r = await parallel(20, () => reserviere(einhorn, '2099-07-02', 6))
  pruefe('20 × 6 Kinder', r.ok.length === 2, `${r.ok.length} gebucht, ${r.abgelehnt.length} abgelehnt`)

  // 3) Summenregel: 20 × 9 Kinder → genau 1 (9 + 9 = 18 > 16)
  r = await parallel(20, () => reserviere(einhorn, '2099-07-03', 9))
  pruefe('20 × 9 Kinder', r.ok.length === 1, `${r.ok.length} gebucht, ${r.abgelehnt.length} abgelehnt`)

  // 4) Idempotenz: 5 × gleicher Schlüssel → überall dieselbe ID, 1 Zeile in der DB
  const schluessel = randomUUID()
  r = await parallel(5, () => reserviere(einhorn, '2099-07-04', 6, schluessel))
  const ids = new Set(r.ok.map(e => e.id))
  const { count } = await supabaseAdmin.from('reservierungen').select('id', { count: 'exact', head: true }).eq('idempotenz_schluessel', schluessel)
  pruefe('Idempotenz', r.ok.length === 5 && ids.size === 1 && count === 1, `${r.ok.length} Antworten, ${ids.size} verschiedene IDs, ${count} Zeile(n)`)

  // 5) Abgelaufener Hold zählt nicht als belegt
  const erste = (await reserviere(einhorn, '2099-07-05', 12)).data as RpcErgebnis
  await supabaseAdmin.from('reservierungen').update({ online_hold_bis: new Date(Date.now() - 60_000).toISOString() } as never).eq('id', erste.id!)
  const zweite = (await reserviere(einhorn, '2099-07-05', 12)).data as RpcErgebnis
  pruefe('Abgelaufener Hold', !!erste.id && !!zweite.id, `zweite Buchung: ${zweite.id ? 'OK' : zweite.fehler}`)

  // 6) Interne Sperrung mit nur 6 Kindern blockiert online komplett
  await supabaseAdmin.from('reservierungen').insert({
    standort_id: STANDORT_ID, loge_id: einhorn, kunde_id: kundeId, typ: 'INTERN', status: 'INTERN_GESPERRT',
    datum: '2099-07-06', zeitslot: 1, kinder_anzahl: 6, paket_preis_pro_kind: 0, gesamtbetrag: 0, anzahlung_betrag: 0,
    angenommen_von: 'TEST',
  })
  const intern = (await reserviere(einhorn, '2099-07-06', 6)).data as RpcErgebnis
  pruefe('INTERN_GESPERRT', intern.fehler === 'SLOT_BELEGT', `Ergebnis: ${intern.fehler ?? 'gebucht (falsch!)'}`)

  // 7) Flexible Loge: 20 × 12 → genau 1; über max_kinder → KAPAZITAET
  r = await parallel(20, () => reserviere(bbq, '2099-07-07', 12))
  pruefe('BBQ Zelt 20 × 12', r.ok.length === 1, `${r.ok.length} gebucht, ${r.abgelehnt.length} abgelehnt`)
  const zuViele = (await reserviere(bbq, '2099-07-08', 21)).data as RpcErgebnis
  pruefe('BBQ Zelt 21 Kinder', zuViele.fehler === 'KAPAZITAET', `Ergebnis: ${zuViele.fehler ?? 'gebucht (falsch!)'}`)

  // 8) Gruppen-Loge ist online gesperrt
  const gruppe = (await reserviere(gruppen, '2099-07-09', 20)).data as RpcErgebnis
  pruefe('Gruppen-Loge', gruppe.fehler === 'LOGE_UNGUELTIG', `Ergebnis: ${gruppe.fehler ?? 'gebucht (falsch!)'}`)

  // 9) Typ wird aus der Loge abgeleitet, Herkunft ist ONLINE, erstellt_von leer
  const { data: zeile } = await supabaseAdmin.from('reservierungen')
    .select('typ, status, angenommen_von, erstellt_von').eq('idempotenz_schluessel', schluessel).single()
  pruefe('Felder', zeile?.typ === 'GEBURTSTAG' && zeile?.status === 'BESTAETIGT_AUSSTEHEND' && zeile?.angenommen_von === 'ONLINE' && (zeile as { erstellt_von?: string | null })?.erstellt_von === null,
    JSON.stringify(zeile))

  // 10) Anon-Key (Browser) darf die Funktion NICHT aufrufen
  const { error: anonFehler } = await supabaseAnon.rpc('reserviere_online', {
    p_standort_id: STANDORT_ID, p_loge_id: einhorn, p_kunde_id: kundeId, p_datum: '2099-07-10', p_zeitslot: 1,
    p_kinder_anzahl: 6, p_erwachsene_anzahl: 0, p_paket_preis_pro_kind: 23, p_gesamtbetrag: 138, p_anzahlung_betrag: 27.6,
    p_notizen: null, p_idempotenz_schluessel: randomUUID(), p_hold_minuten: 35,
  })
  pruefe('Anon gesperrt', !!anonFehler, anonFehler ? `abgelehnt: ${anonFehler.message}` : 'Aufruf ging durch (falsch!)')

}

// Aufräumen läuft IMMER (finally) — auch wenn ein Test mittendrin abbricht
async function ausfuehren() {
  let abgebrochen = false
  try {
    await main()
  } catch (err) {
    abgebrochen = true
    console.error('Unerwarteter Fehler:', err)
  } finally {
    await aufraeumen()
    console.log('\nTestdaten aufgeräumt.')
  }
  const ok = !abgebrochen && fehlgeschlagen === 0
  console.log(ok ? 'ALLE TESTS BESTANDEN' : abgebrochen ? 'TEST ABGEBROCHEN' : `${fehlgeschlagen} TEST(S) FEHLGESCHLAGEN`)
  process.exit(ok ? 0 : 1)
}

ausfuehren()
