// Kontrolle nach Migration 014 (ganze_loge): Ist reserviere_online rückwärtskompatibel?
//
//   npx tsx --env-file=.env.local scripts/test-migration-014.ts
//
// 1. Aufruf mit EXAKT den 13 Parametern, die der Code auf main sendet (ohne p_ganze_loge)
//    → Reservierung angelegt, ganze_loge = false. Das ist der Aufruf des Live-Widgets.
// 2. Zweite Gruppe (alter Aufruf) am Nachbartisch → weiterhin möglich (Verhalten wie bisher).
// 3. Neuer Aufruf mit p_ganze_loge = true auf leerer Loge → ganze_loge = true;
//    danach jede weitere Online-Buchung auf diesem Slot → SLOT_BELEGT.
// Testdaten im Jahr 2099, werden im finally gelöscht.

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const STANDORT_ID = '00000000-0000-0000-0000-000000000001'
const DATUM = '2099-10-06'

let fehlgeschlagen = 0
function pruefe(bedingung: boolean, text: string, details?: unknown) {
  if (bedingung) console.log(`  ✓ ${text}`)
  else { fehlgeschlagen++; console.error(`  ✗ ${text}`, details ?? '') }
}

const kunden = new Set<string>()
const reservierungen = new Set<string>()

// Genau die Parameter aus src/app/api/buchen/[standort]/reservieren/route.ts auf main
function alteParameter(logeId: string, kundeId: string, kinder: number) {
  return {
    p_standort_id: STANDORT_ID,
    p_loge_id: logeId,
    p_kunde_id: kundeId,
    p_datum: DATUM,
    p_zeitslot: 1,
    p_kinder_anzahl: kinder,
    p_erwachsene_anzahl: 1,
    p_paket_preis_pro_kind: 23,
    p_gesamtbetrag: kinder * 23,
    p_anzahlung_betrag: Number((kinder * 23 * 0.2).toFixed(2)),
    p_notizen: 'TEST Migration 014',
    p_idempotenz_schluessel: randomUUID(),
    p_hold_minuten: 35,
  }
}

async function rpc(params: Record<string, unknown>) {
  const { data, error } = await db.rpc('reserviere_online', params)
  if (error) return { fehler: 'RPC_FEHLER', hinweis: error.message } as Record<string, unknown>
  const d = data as Record<string, unknown>
  if (typeof d?.id === 'string') reservierungen.add(d.id)
  return d
}

async function ganzeLoge(id: unknown): Promise<boolean | null> {
  if (typeof id !== 'string') return null
  const { data } = await db.from('reservierungen').select('ganze_loge').eq('id', id).single()
  return data?.ganze_loge ?? null
}

async function main() {
  try {
    const { data: logen } = await db.from('logen').select('id, name')
      .eq('standort_id', STANDORT_ID).eq('aktiv', true).eq('online_buchbar', true).eq('kapazitaet_flexibel', false)
      .order('name').limit(2)
    if (!logen || logen.length < 2) throw new Error('Zu wenige feste, online buchbare Logen')
    const [logeA, logeB] = logen

    const { data: k, error: kErr } = await db.from('kunden').insert({
      standort_id: STANDORT_ID, vorname: 'Test', nachname: 'Migration014', telefon: '00000000014',
      dsgvo_einwilligung: false, newsletter_opt_in: false,
    }).select('id').single()
    if (kErr || !k) throw new Error(`Kunde: ${kErr?.message}`)
    kunden.add(k.id)

    console.log(`\n1. Alter Aufruf (13 Parameter, wie main) – ${logeA.name}`)
    const r1 = await rpc(alteParameter(logeA.id, k.id, 6))
    pruefe(typeof r1.id === 'string' && !r1.fehler, 'Reservierung angelegt', r1)
    pruefe(await ganzeLoge(r1.id) === false, 'ganze_loge = false')

    console.log('\n2. Zweite Gruppe am Nachbartisch (alter Aufruf)')
    const r2 = await rpc(alteParameter(logeA.id, k.id, 5))
    pruefe(typeof r2.id === 'string' && !r2.fehler, 'wie bisher möglich', r2)

    console.log(`\n3. Neuer Aufruf mit p_ganze_loge = true – ${logeB.name}`)
    const r3 = await rpc({ ...alteParameter(logeB.id, k.id, 7), p_ganze_loge: true })
    pruefe(typeof r3.id === 'string' && !r3.fehler, 'Reservierung angelegt', r3)
    pruefe(await ganzeLoge(r3.id) === true, 'ganze_loge = true')
    const r4 = await rpc(alteParameter(logeB.id, k.id, 3))
    pruefe(r4.fehler === 'SLOT_BELEGT', 'weitere Gruppe auf diesem Slot → SLOT_BELEGT', r4)
  } finally {
    if (reservierungen.size) await db.from('reservierungen').delete().in('id', [...reservierungen])
    if (kunden.size) await db.from('kunden').delete().in('id', [...kunden])
  }
  console.log(fehlgeschlagen ? `\n❌ ${fehlgeschlagen} Prüfung(en) fehlgeschlagen` : '\n✅ Alle Prüfungen grün')
  process.exit(fehlgeschlagen ? 1 : 0)
}
void main()
