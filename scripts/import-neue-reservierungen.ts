// Bulk-Import weiterer manueller Reservierungen aus Geburtstagskalender_Neue_Reservierungen-v5.xlsx
// Ausführung: node --env-file=.env.local scripts/import-neue-reservierungen.ts            (Vorschau)
//             node --env-file=.env.local scripts/import-neue-reservierungen.ts --commit   (schreibt wirklich)
//
// Kein Stripe, kein SMS, keine E-Mail — reine Datenbank-Inserts.
// status=BESTAETIGT_BEZAHLT, anzahlung_betrag=0, angenommen_von='Import' (keine Anzahlung kassiert).
// Prüft Duplikate gegen bereits existierende Kunden+Datum, und aktuelle Logenkapazität live gegen die DB.

import pkg from 'xlsx'
const { readFile, utils } = pkg
import { createClient } from '@supabase/supabase-js'
import { berechneGesamtbetrag } from '../src/lib/utils/preise.ts'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const COMMIT = process.argv.includes('--commit')
const DATEI = 'Geburtstagskalender_Neue_Reservierungen-v5.xlsx'

// ─── Zeilen, die manuell nachgetragen werden (unvollständige Daten / Sonderfälle) ───
const SKIP_ZEILEN = new Set([11, 43, 49, 56, 58, 61])

// ─── Loge-Namen-Normalisierung ──────────────────────────────────────────────
const LOGE_ALIAS: Record<string, string> = {
  'anna und elsa': 'Anna & Elsa',
  'marvel spider-man': 'Marvel Spiderman',
  'spider-man': 'Marvel Spiderman',
  'safari': 'Safari',
  'safari loge': 'Safari',
  'safari-loge': 'Safari',
  'paw patrol jungs': 'Paw Patrol Jungs',
  'paw patrol mädchen': 'Paw Patrol Mädchen',
  'einhorn schloss': 'Einhorn Schloss',
  'einhorn-schloss': 'Einhorn Schloss',
  'einhorn regenbogen': 'Einhorn Regenbogen',
  'babywelt junge': 'Babywelt Junge',
  'babywelt jungs': 'Babywelt Junge',
  'babywelt mädchen': 'Babywelt Märchen',
  'runde tische unten': 'Runde Tische unten',
  'bbq zelt': 'BBQ Zelt',
  'pfadfinderjungs': 'Paw Patrol Jungs',
}
const LOGE_SKIP = new Set(['eventl-grundschule', 'sonderbuchung'])

// Fehlende Telefonnummern, wo Upsalla einen eindeutigen Platzhalter bestätigt hat
// (NIE dieselbe Nummer zweimal verwenden — führt sonst zur Kundenvermischung)
const TELEFON_PLATZHALTER: Record<number, string> = {
  9: 'KEIN-TEL-FRAU-KADER',
}

function normalisiereLogeName(roh: string): { name: string | null; grund?: string } {
  const ohneKlammer = roh.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const key = ohneKlammer.toLowerCase()
  if (LOGE_SKIP.has(key)) return { name: null, grund: `Sonderfall "${roh}" — manuell nachtragen` }
  const alias = LOGE_ALIAS[key]
  if (!alias) return { name: null, grund: `Unbekannte Loge "${roh}"` }
  return { name: alias }
}

// ─── Zeitslot-Zuordnung ──────────────────────────────────────────────────────
function zeitslotAusUhrzeit(uhrzeit: string, zweiSlotTag: boolean): number | null {
  if (uhrzeit === '10:30 - 14:30') return 1
  if (uhrzeit === '15:00 - 19:00') return zweiSlotTag ? 2 : 1
  return null
}

// ─── Geschlossene Tage (Silvester/Neujahr) ───────────────────────────────────
function istGeschlossen(datumStr: string): boolean {
  const [, m, t] = datumStr.split('-').map(Number)
  return (m === 12 && t === 31) || (m === 1 && t === 1)
}

// ─── NRW Feiertage (dupliziert aus src/lib/utils/feiertage.ts — reine Berechnung, kein Import wegen @/-Alias) ───
function berechneOstern(jahr: number): Date {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monat = Math.floor((h + l - 7 * m + 114) / 31)
  const tag = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(jahr, monat - 1, tag)
}
function addTage(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function gleichesDatum(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}
function istNRWFeiertag(datum: Date): boolean {
  const o = berechneOstern(datum.getFullYear())
  const feiertage = [
    new Date(datum.getFullYear(), 0, 1), addTage(o, -2), o, addTage(o, 1),
    new Date(datum.getFullYear(), 4, 1), addTage(o, 39), addTage(o, 49), addTage(o, 50), addTage(o, 60),
    new Date(datum.getFullYear(), 9, 3), new Date(datum.getFullYear(), 10, 1),
    new Date(datum.getFullYear(), 11, 25), new Date(datum.getFullYear(), 11, 26),
  ]
  return feiertage.some(f => gleichesDatum(f, datum))
}

let schulferienCache: Array<{ start_datum: string; end_datum: string }> | null = null
async function istSchulferien(datumStr: string): Promise<boolean> {
  if (!schulferienCache) {
    const { data } = await supabaseAdmin.from('nrw_schulferien').select('start_datum, end_datum')
    schulferienCache = data ?? []
  }
  return schulferienCache.some(f => f.start_datum <= datumStr && datumStr <= f.end_datum)
}

async function istZweiSlotTag(datumStr: string): Promise<boolean> {
  const d = new Date(datumStr + 'T00:00:00')
  const tag = d.getDay()
  if (tag === 0 || tag === 6) return true
  if (istNRWFeiertag(d)) return true
  return istSchulferien(datumStr)
}

// ─── Name splitten ────────────────────────────────────────────────────────
function splitName(voll: string): { vorname: string; nachname: string } {
  const teile = voll.trim().split(/\s+/)
  if (teile.length === 1) return { vorname: teile[0], nachname: '-' }
  return { vorname: teile[0], nachname: teile.slice(1).join(' ') }
}

interface ImportZeile {
  zeile: number
  datum: string
  uhrzeit: string
  logeRoh: string
  name: string
  telefon: string
  email: string
  kinder: string
  erwachsene: string
  notizen: string
}

async function main() {
  const wb = readFile(DATEI)
  const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }) as string[][]

  const { data: standort } = await supabaseAdmin.from('standorte').select('id').eq('stadt', 'Wuppertal').single()
  if (!standort) { console.error('Standort Wuppertal nicht gefunden.'); process.exit(1) }

  const { data: logenDaten } = await supabaseAdmin
    .from('logen')
    .select('id, name, ist_babywelt, max_kinder, kapazitaet_flexibel')
    .eq('standort_id', standort.id)
  const logenMap = new Map((logenDaten ?? []).map(l => [l.name, l]))

  const ergebnisse: Array<{ zeile: number; status: 'IMPORT' | 'SKIP'; grund?: string; daten?: Record<string, unknown> }> = []

  for (let i = 1; i < rows.length; i++) {
    const [datum, uhrzeit, logeRoh, name, telefon, email, kinder, erwachsene, notizen] = rows[i] as unknown as string[]
    const z: ImportZeile = { zeile: i, datum, uhrzeit, logeRoh, name, telefon, email, kinder, erwachsene, notizen }

    if (SKIP_ZEILEN.has(i)) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: 'Unvollständige Daten / Sonderfall — manuell nachtragen' })
      continue
    }

    if (istGeschlossen(z.datum)) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: 'Datum ist ein Schließtag (Silvester/Neujahr)' })
      continue
    }

    const { name: logeName, grund: logeGrund } = normalisiereLogeName(z.logeRoh)
    if (!logeName) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: logeGrund })
      continue
    }
    const loge = logenMap.get(logeName)
    if (!loge) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: `Loge "${logeName}" nicht in DB gefunden` })
      continue
    }

    const zweiSlot = await istZweiSlotTag(z.datum)
    const zeitslot = zeitslotAusUhrzeit(z.uhrzeit, zweiSlot)
    if (!zeitslot) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: `Unbekannte Uhrzeit "${z.uhrzeit}"` })
      continue
    }

    if (!/^\d+$/.test(z.kinder.trim())) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: `Kinderanzahl unklar: "${z.kinder}"` })
      continue
    }
    if (z.erwachsene && !/^\d+$/.test(z.erwachsene.trim())) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: `Erwachsenenanzahl unklar: "${z.erwachsene}"` })
      continue
    }
    const kinderAnzahl = parseInt(z.kinder, 10)
    const erwachseneAnzahl = z.erwachsene ? parseInt(z.erwachsene, 10) : 0
    const telefonEffektiv = z.telefon.trim() || TELEFON_PLATZHALTER[i] || ''
    if (!telefonEffektiv) {
      ergebnisse.push({ zeile: i, status: 'SKIP', grund: 'Telefonnummer fehlt' })
      continue
    }

    // Duplikat-Prüfung: existiert schon ein Kunde mit dieser Telefonnummer UND
    // hat er schon eine Reservierung am selben Datum?
    const { data: vorhandenerKunde } = await supabaseAdmin
      .from('kunden').select('id').eq('telefon', telefonEffektiv).maybeSingle()
    if (vorhandenerKunde) {
      const { data: vorhandeneRes } = await supabaseAdmin
        .from('reservierungen').select('id').eq('kunde_id', vorhandenerKunde.id).eq('datum', z.datum).maybeSingle()
      if (vorhandeneRes) {
        ergebnisse.push({ zeile: i, status: 'SKIP', grund: `Duplikat — Kunde hat bereits eine Reservierung am ${z.datum}` })
        continue
      }
    }

    const { vorname, nachname } = splitName(z.name)
    const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, zweiSlot, erwachseneAnzahl)
    const anzahlungBetrag = 0
    const paketPreisProKind = zweiSlot ? 27.0 : 23.0
    const typ = loge.ist_babywelt ? 'BABYWELT_GEBURTSTAG' : 'GEBURTSTAG'

    ergebnisse.push({
      zeile: i,
      status: 'IMPORT',
      daten: {
        standort_id: standort.id,
        loge_id: loge.id,
        loge_name: logeName,
        typ,
        status_wert: 'BESTAETIGT_BEZAHLT',
        datum: z.datum,
        zeitslot,
        kinder_anzahl: kinderAnzahl,
        erwachsene_anzahl: erwachseneAnzahl,
        paket_preis_pro_kind: paketPreisProKind,
        gesamtbetrag,
        anzahlung_betrag: anzahlungBetrag,
        notizen: z.notizen || null,
        angenommen_von: 'Import',
        vorname, nachname,
        telefon: telefonEffektiv,
        email: z.email?.trim() || null,
      },
    })
  }

  const importZeilen = ergebnisse.filter(e => e.status === 'IMPORT')
  const skipZeilen = ergebnisse.filter(e => e.status === 'SKIP')

  console.log(`\n=== Vorschau: ${importZeilen.length} zu importieren, ${skipZeilen.length} übersprungen ===\n`)
  for (const e of ergebnisse) {
    if (e.status === 'SKIP') {
      console.log(`Zeile ${e.zeile}: SKIP — ${e.grund}`)
    } else {
      const d = e.daten!
      console.log(`Zeile ${e.zeile}: IMPORT — ${d.datum} Slot ${d.zeitslot} · ${d.loge_name} · ${d.vorname} ${d.nachname} (${d.telefon}) · ${d.kinder_anzahl} Kinder · ${(d.gesamtbetrag as number).toFixed(2)}€`)
    }
  }

  if (!COMMIT) {
    console.log('\n--- DRY RUN — keine Daten geschrieben. Mit --commit ausführen, um wirklich zu importieren. ---')
    return
  }

  console.log('\n=== COMMIT — schreibe in Supabase ===\n')
  let erstellt = 0, wiederverwendet = 0, fehler = 0, kapazitaetAbgelehnt = 0

  for (const e of importZeilen) {
    const d = e.daten!
    try {
      // Live-Kapazitätsprüfung gegen aktuellen DB-Stand (inkl. bereits in diesem Lauf importierter Zeilen)
      const loge = logenMap.get(d.loge_name as string)!
      if (!loge.kapazitaet_flexibel) {
        const { data: belegungen } = await supabaseAdmin
          .from('reservierungen')
          .select('kinder_anzahl')
          .eq('loge_id', d.loge_id).eq('datum', d.datum).eq('zeitslot', d.zeitslot)
          .neq('status', 'STORNIERT')
        const bereitsKinder = (belegungen ?? []).reduce((s, r) => s + r.kinder_anzahl, 0)
        const maxKinder = loge.max_kinder ?? 16
        if ((belegungen ?? []).length >= 2 || bereitsKinder + (d.kinder_anzahl as number) > maxKinder) {
          console.error(`Zeile ${e.zeile} ÜBERSPRUNGEN — Kapazität überschritten (${bereitsKinder} + ${d.kinder_anzahl} > ${maxKinder} oder schon 2 Gruppen)`)
          kapazitaetAbgelehnt++
          continue
        }
      }

      const { data: vorhandenerKunde } = await supabaseAdmin
        .from('kunden').select('id').eq('telefon', d.telefon).maybeSingle()

      let kundeId: string
      if (vorhandenerKunde) {
        kundeId = vorhandenerKunde.id
      } else {
        const { data: neuerKunde, error } = await supabaseAdmin
          .from('kunden')
          .insert({
            standort_id: d.standort_id, vorname: d.vorname, nachname: d.nachname,
            telefon: d.telefon, email: d.email, dsgvo_einwilligung: true, newsletter_opt_in: false,
          })
          .select('id').single()
        if (error || !neuerKunde) throw new Error(`Kunde: ${error?.message}`)
        kundeId = neuerKunde.id
      }

      const reservierungsDaten = {
        standort_id: d.standort_id,
        loge_id: d.loge_id,
        kunde_id: kundeId,
        typ: d.typ,
        status: d.status_wert,
        datum: d.datum,
        zeitslot: d.zeitslot,
        kinder_anzahl: d.kinder_anzahl,
        erwachsene_anzahl: d.erwachsene_anzahl,
        paket_preis_pro_kind: d.paket_preis_pro_kind,
        gesamtbetrag: d.gesamtbetrag,
        anzahlung_betrag: d.anzahlung_betrag,
        notizen: d.notizen,
        angenommen_von: d.angenommen_von,
        stripe_payment_link: null,
        stripe_payment_intent_id: null,
      }

      const { data: storniert } = await supabaseAdmin
        .from('reservierungen').select('id')
        .eq('loge_id', d.loge_id).eq('datum', d.datum).eq('zeitslot', d.zeitslot)
        .eq('status', 'STORNIERT').maybeSingle()

      if (storniert) {
        const { error } = await supabaseAdmin.from('reservierungen').update(reservierungsDaten).eq('id', storniert.id)
        if (error) throw new Error(`Reservierung: ${error.message}`)
        wiederverwendet++
      } else {
        const { error } = await supabaseAdmin.from('reservierungen').insert(reservierungsDaten)
        if (error) throw new Error(`Reservierung: ${error.message}`)
        erstellt++
      }
    } catch (err) {
      fehler++
      console.error(`Zeile ${e.zeile} FEHLER:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`\n=== Fertig: ${erstellt} erstellt, ${wiederverwendet} wiederverwendet, ${kapazitaetAbgelehnt} an Kapazität gescheitert, ${fehler} Fehler ===`)
}

main().catch(err => { console.error('Unerwarteter Fehler:', err); process.exit(1) })
