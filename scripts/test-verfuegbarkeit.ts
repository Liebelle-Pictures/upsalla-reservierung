// Test für src/lib/verfuegbarkeit.ts (Phase 3 Online-Buchung).
//
// Teil A (ohne DB): berechneFreieSlots in beiden Modi — LENA (unverändertes Verhalten) und
//                   ONLINE (Regeln von reserviere_online), tagesStatus, Buchungsfenster.
// Teil B (mit DB):  Konsistenz ONLINE ↔ reserviere_online. Auf Testdaten im August 2099 wird
//                   für jede Loge/jeden Slot geprüft:
//                     - als frei angezeigt  ⇒ Funktion nimmt max_kinder an und lehnt max_kinder+1 ab
//                     - nicht angezeigt     ⇒ Funktion lehnt ab (oder Widget ist bewusst strenger,
//                                             z.B. verfuegbarkeit_regel)
//                   Testdaten werden vorher und am Ende (finally) aufgeräumt.
//
// Aufruf: npx tsx --env-file=.env.local scripts/test-verfuegbarkeit.ts

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  berechneFreieSlots, berechneVerfuegbarkeit, berechneMonatsuebersicht, tagesStatus,
  type LogeZeile, type BelegungZeile, type VerfuegbarSlot,
} from '../src/lib/verfuegbarkeit'
import { buchungsfenster, istGueltigesDatum, istGueltigerMonat, heuteImPark } from '../src/lib/online-buchung/validierung'
import { logeIstVerfuegbarFuerSlot } from '../src/lib/utils/zeitslots'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const STANDORT_ID = '00000000-0000-0000-0000-000000000001'
const TEST_TELEFON = '00000000092'
const TEST_VON = '2099-08-01'
const TEST_BIS = '2099-08-31'

let fehlgeschlagen = 0
let kundeId = ''

function pruefe(name: string, bedingung: boolean, details = '') {
  console.log(`${bedingung ? '✓' : '✗'} ${name}${details ? ' — ' + details : ''}`)
  if (!bedingung) fehlgeschlagen++
}

// ─── Teil A: reine Funktionen ─────────────────────────────────────────────────

function loge(id: string, extra: Partial<LogeZeile> = {}): LogeZeile {
  return { id, name: id, ist_babywelt: false, kapazitaet_flexibel: false, verfuegbarkeit_regel: null, max_kinder: 16, online_buchbar: true, ...extra }
}
function beleg(loge_id: string, kinder: number, extra: Partial<BelegungZeile> = {}): BelegungZeile {
  return { loge_id, zeitslot: 1, kinder_anzahl: kinder, status: 'BESTAETIGT_BEZAHLT', angenommen_von: 'KI LENA', online_hold_bis: null, ...extra }
}
function finde(liste: VerfuegbarSlot[], logeId: string, slot = 1) {
  return liste.find(v => v.loge_id === logeId && v.zeitslot === slot)
}

function teilA() {
  console.log('\n— Teil A: reine Funktionen —')
  const jetzt = new Date('2099-08-01T09:00:00Z')
  const vorbei = new Date(jetzt.getTime() - 60_000).toISOString()
  const spaeter = new Date(jetzt.getTime() + 60_000).toISOString()
  const montag = new Date('2099-08-03T00:00:00')   // 1 Slot
  const logen = [
    loge('intern'), loge('halb'), loge('exklusiv'), loge('zwei'), loge('abgelaufen'), loge('hold'),
    loge('bbq', { kapazitaet_flexibel: true, max_kinder: 20 }),
    loge('gruppen', { kapazitaet_flexibel: true, max_kinder: 150, online_buchbar: false, verfuegbarkeit_regel: 'NUR_WOCHENTAG' }),
    loge('frei', { max_kinder: 20 }),
  ]
  const belegungen = [
    beleg('intern', 6, { status: 'INTERN_GESPERRT', angenommen_von: null }),
    beleg('halb', 6),
    beleg('exklusiv', 12),
    beleg('zwei', 4), beleg('zwei', 4),
    beleg('abgelaufen', 12, { angenommen_von: 'ONLINE', status: 'BESTAETIGT_AUSSTEHEND', online_hold_bis: vorbei }),
    beleg('hold', 12, { angenommen_von: 'ONLINE', status: 'BESTAETIGT_AUSSTEHEND', online_hold_bis: spaeter }),
  ]
  const lena = berechneFreieSlots(montag, false, logen, belegungen, 'LENA', jetzt)
  const online = berechneFreieSlots(montag, false, logen, belegungen, 'ONLINE', jetzt)

  // LENA: bisheriges Verhalten
  pruefe('LENA: INTERN_GESPERRT mit 6 Kindern → halb frei', finde(lena, 'intern')?.teil_belegt === true && finde(lena, 'intern')?.max_kinder === 10)
  pruefe('LENA: abgelaufener Online-Hold zählt weiter als belegt', !finde(lena, 'abgelaufen'))
  pruefe('LENA: Gruppen-Loge erscheint (Wochentag)', !!finde(lena, 'gruppen'))
  pruefe('LENA: flexible Loge ohne Deckel (max_kinder null)', finde(lena, 'bbq')?.max_kinder === null)
  pruefe('LENA: halb belegt → Rest 10', finde(lena, 'halb')?.max_kinder === 10 && finde(lena, 'halb')?.bereits_kinder === 6)
  pruefe('LENA: Feldreihenfolge unverändert', JSON.stringify(Object.keys(finde(lena, 'halb')!)) === JSON.stringify(['loge_id', 'loge_name', 'ist_babywelt', 'zeitslot', 'uhrzeit', 'teil_belegt', 'bereits_kinder', 'max_kinder']))

  // ONLINE: Regeln von reserviere_online
  pruefe('ONLINE: INTERN_GESPERRT blockiert komplett', !finde(online, 'intern'))
  pruefe('ONLINE: Gruppen-Loge fehlt', !finde(online, 'gruppen'))
  pruefe('ONLINE: abgelaufener Online-Hold zählt nicht', finde(online, 'abgelaufen')?.teil_belegt === false && finde(online, 'abgelaufen')?.max_kinder === 16)
  pruefe('ONLINE: aktiver Online-Hold blockiert', !finde(online, 'hold'))
  pruefe('ONLINE: flexible Loge mit max_kinder', finde(online, 'bbq')?.max_kinder === 20)
  pruefe('ONLINE: halb belegt → max 9 (zweite Gruppe < 10)', finde(online, 'halb')?.max_kinder === 9)
  pruefe('beide: exklusive Gruppe blockiert', !finde(lena, 'exklusiv') && !finde(online, 'exklusiv'))
  pruefe('beide: zwei Gruppen blockieren', !finde(lena, 'zwei') && !finde(online, 'zwei'))
  pruefe('beide: freie Loge mit max_kinder', finde(lena, 'frei')?.max_kinder === 20 && finde(online, 'frei')?.max_kinder === 20)

  // Wochenende: 2 Slots, KEIN_WE_NACHMITTAG
  const samstag = new Date('2099-08-01T00:00:00')
  const rund = [loge('rund', { verfuegbarkeit_regel: 'KEIN_WE_NACHMITTAG', max_kinder: 18 })]
  const we = berechneFreieSlots(samstag, true, rund, [], 'ONLINE', jetzt)
  pruefe('Runde Tische: Samstag nur Slot 1', !!finde(we, 'rund', 1) && !finde(we, 'rund', 2))

  pruefe('tagesStatus', tagesStatus(0, true) === 'geschlossen' && tagesStatus(0, false) === 'ausgebucht'
    && tagesStatus(2, false) === 'wenige' && tagesStatus(3, false) === 'frei')

  // Buchungsfenster / Validierung
  const f = buchungsfenster(new Date('2026-10-31T23:30:00Z'))   // in Berlin schon 01.11.
  pruefe('heuteImPark nutzt Europe/Berlin', heuteImPark(new Date('2026-10-31T23:30:00Z')) === '2026-11-01')
  pruefe('Buchungsfenster +2 / +180 Tage', f.von === '2026-11-03' && f.bis === '2027-04-30', `${f.von} … ${f.bis}`)
  pruefe('istGueltigesDatum', istGueltigesDatum('2026-02-28') && !istGueltigesDatum('2026-02-31') && !istGueltigesDatum('07.11.2026') && !istGueltigesDatum(null))
  pruefe('istGueltigerMonat', istGueltigerMonat('2026-11') && !istGueltigerMonat('2026-13') && !istGueltigerMonat('2026-1'))
}

// ─── Teil B: Konsistenz mit reserviere_online ─────────────────────────────────

async function aufraeumen() {
  const { data: kunde } = await supabaseAdmin.from('kunden').select('id').eq('telefon', TEST_TELEFON).maybeSingle()
  if (kunde) {
    const { error: e1 } = await supabaseAdmin.from('reservierungen').delete().eq('kunde_id', kunde.id).gte('datum', TEST_VON).lte('datum', TEST_BIS)
    if (e1) console.error('Aufräumen Reservierungen fehlgeschlagen:', e1.message)
    const { error: e2 } = await supabaseAdmin.from('kunden').delete().eq('id', kunde.id)
    if (e2) console.error('Aufräumen Kunde fehlgeschlagen:', e2.message)
  }
}

interface RpcErgebnis { id?: string; fehler?: string }

async function rpc(logeId: string, datum: string, zeitslot: number, kinder: number): Promise<RpcErgebnis> {
  const { data, error } = await supabaseAdmin.rpc('reserviere_online', {
    p_standort_id: STANDORT_ID, p_loge_id: logeId, p_kunde_id: kundeId, p_datum: datum, p_zeitslot: zeitslot,
    p_kinder_anzahl: kinder, p_erwachsene_anzahl: 0, p_paket_preis_pro_kind: 27, p_gesamtbetrag: 0, p_anzahlung_betrag: 0,
    p_notizen: 'TEST verfuegbarkeit', p_idempotenz_schluessel: randomUUID(), p_hold_minuten: 35,
  })
  if (error) throw new Error(`RPC-Fehler: ${error.message}`)
  const e = data as RpcErgebnis
  // Erfolgreiche Probebuchung sofort wieder löschen, damit der Zustand gleich bleibt
  if (e.id) await supabaseAdmin.from('reservierungen').delete().eq('id', e.id)
  return e
}

async function einfuegen(logeId: string, datum: string, zeitslot: number, kinder: number, extra: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin.from('reservierungen').insert({
    standort_id: STANDORT_ID, loge_id: logeId, kunde_id: kundeId, typ: 'GEBURTSTAG', status: 'BESTAETIGT_BEZAHLT',
    datum, zeitslot, kinder_anzahl: kinder, paket_preis_pro_kind: 27, gesamtbetrag: 0, anzahlung_betrag: 0,
    angenommen_von: 'TEST', ...extra,
  })
  if (error) throw new Error(`Testbuchung: ${error.message}`)
}

async function vergleicheMitFunktion(datum: string) {
  const datumObj = new Date(datum + 'T00:00:00')
  const ergebnis = await berechneVerfuegbarkeit({ standortId: STANDORT_ID, datum, modus: 'ONLINE' })
  const { data: logen } = await supabaseAdmin.from('logen').select('id, name, verfuegbarkeit_regel, max_kinder').eq('standort_id', STANDORT_ID).eq('aktiv', true).order('name')
  const slots = datumObj.getDay() === 0 || datumObj.getDay() === 6 ? [1, 2] : [1]
  let geprueft = 0
  let fehler = 0
  for (const l of logen ?? []) {
    for (const slot of slots) {
      const angezeigt = finde(ergebnis.verfuegbar, l.id, slot)
      if (angezeigt) {
        const max = angezeigt.max_kinder as number
        const ok = await rpc(l.id, datum, slot, max)
        const zuViel = await rpc(l.id, datum, slot, max + 1)
        if (!ok.id || zuViel.id) {
          fehler++
          console.log(`   ✗ ${l.name} Slot ${slot}: angezeigt max ${max}, Funktion: ${max} → ${ok.fehler ?? 'OK'}, ${max + 1} → ${zuViel.fehler ?? 'OK'}`)
        }
      } else {
        const r = await rpc(l.id, datum, slot, 6)
        const bewusstStrenger = !logeIstVerfuegbarFuerSlot(l.verfuegbarkeit_regel, datumObj, slot)
        if (r.id && !bewusstStrenger) {
          fehler++
          console.log(`   ✗ ${l.name} Slot ${slot}: nicht angezeigt, aber Funktion nimmt 6 Kinder an`)
        }
      }
      geprueft++
    }
  }
  pruefe(`ONLINE ↔ reserviere_online am ${datum}`, fehler === 0, `${geprueft} Loge/Slot-Kombinationen, ${fehler} Abweichung(en), ${ergebnis.verfuegbar.length} frei`)
  return ergebnis
}

async function teilB() {
  console.log('\n— Teil B: Konsistenz mit reserviere_online (DB) —')
  await aufraeumen()
  const { data: kunde, error } = await supabaseAdmin.from('kunden')
    .insert({ standort_id: STANDORT_ID, vorname: 'TEST', nachname: 'Verfuegbarkeit', telefon: TEST_TELEFON, dsgvo_einwilligung: true })
    .select('id').single()
  if (error || !kunde) throw new Error(`Testkunde: ${error?.message}`)
  kundeId = kunde.id

  const { data: logen } = await supabaseAdmin.from('logen').select('id, name').eq('standort_id', STANDORT_ID)
  const id = (name: string) => {
    const l = logen?.find(x => x.name === name)
    if (!l) throw new Error(`Loge "${name}" nicht gefunden`)
    return l.id as string
  }
  const vorbei = new Date(Date.now() - 60_000).toISOString()
  const spaeter = new Date(Date.now() + 30 * 60_000).toISOString()

  // Samstag 01.08.2099: alle Sonderfälle in Slot 1, Slot 2 bleibt frei
  const sa = '2099-08-01'
  await einfuegen(id('Einhorn Schloss'), sa, 1, 6, { typ: 'INTERN', status: 'INTERN_GESPERRT', paket_preis_pro_kind: 0 })
  await einfuegen(id('Paw Patrol Jungs'), sa, 1, 6)
  await einfuegen(id('Safari'), sa, 1, 12)
  await einfuegen(id('Babywelt Junge'), sa, 1, 4, { typ: 'BABYWELT_GEBURTSTAG' })
  await einfuegen(id('Babywelt Junge'), sa, 1, 4, { typ: 'BABYWELT_GEBURTSTAG' })
  await einfuegen(id('BBQ Zelt'), sa, 1, 5)
  await einfuegen(id('Anna & Elsa'), sa, 1, 12, { angenommen_von: 'ONLINE', status: 'BESTAETIGT_AUSSTEHEND', online_hold_bis: vorbei })
  await einfuegen(id('Marvel Spiderman'), sa, 1, 12, { angenommen_von: 'ONLINE', status: 'BESTAETIGT_AUSSTEHEND', online_hold_bis: spaeter })
  await einfuegen(id('Paw Patrol Mädchen'), sa, 1, 16, { status: 'STORNIERT' })
  const erg = await vergleicheMitFunktion(sa)
  pruefe('Samstag: INTERN_GESPERRT-Loge fehlt online', !finde(erg.verfuegbar, id('Einhorn Schloss'), 1))
  pruefe('Samstag: abgelaufener Hold → Loge online frei', finde(erg.verfuegbar, id('Anna & Elsa'), 1)?.max_kinder === 16)
  pruefe('Samstag: stornierte Buchung blockiert nicht', finde(erg.verfuegbar, id('Paw Patrol Mädchen'), 1)?.teil_belegt === false)

  const lena = await berechneVerfuegbarkeit({ standortId: STANDORT_ID, datum: sa, modus: 'LENA' })
  pruefe('Samstag LENA: INTERN_GESPERRT-Loge weiter halb frei', finde(lena.verfuegbar, id('Einhorn Schloss'), 1)?.teil_belegt === true)
  pruefe('Samstag LENA: abgelaufener Hold blockiert weiter', !finde(lena.verfuegbar, id('Anna & Elsa'), 1))

  // Montag 03.08.2099: Wochentag, Gruppen wäre für Lena buchbar
  const mo = '2099-08-03'
  await einfuegen(id('Runde Tische unten'), mo, 1, 9)
  const ergMo = await vergleicheMitFunktion(mo)
  const lenaMo = await berechneVerfuegbarkeit({ standortId: STANDORT_ID, datum: mo, modus: 'LENA' })
  pruefe('Montag: Gruppen fehlt online, ist für Lena da', !finde(ergMo.verfuegbar, id('Gruppen')) && !!finde(lenaMo.verfuegbar, id('Gruppen')))

  // Monatsübersicht: gleicher Tag muss gleich viele freie Kombinationen haben wie berechneVerfuegbarkeit
  const monat = await berechneMonatsuebersicht(STANDORT_ID, '2099-08')
  const tagSa = monat.find(t => t.datum === sa)
  pruefe('Monatsübersicht: 31 Tage, Samstag mit Wochenendpreis', monat.length === 31 && tagSa?.wochenendpreis === true)
  pruefe('Monatsübersicht = Tagesansicht', tagSa?.status === tagesStatus(erg.verfuegbar.length, false), `Status ${tagSa?.status}`)
}

async function ausfuehren() {
  let abgebrochen = false
  try {
    teilA()
    await teilB()
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
