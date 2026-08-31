import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TEST_DATUM = '2099-06-15'
const TEST_TELEFON_1 = '00000000001'
const TEST_TELEFON_2 = '00000000002'

async function aufraeumen() {
  await supabaseAdmin.from('reservierungen').delete().eq('datum', TEST_DATUM)
  await supabaseAdmin.from('kunden').delete().in('telefon', [TEST_TELEFON_1, TEST_TELEFON_2])
}

async function main() {
  // Vorherige Testreste entfernen (falls Skript schon mal lief)
  await aufraeumen()

  const { data: standort } = await supabaseAdmin.from('standorte').select('id').limit(1).single()
  const { data: loge } = await supabaseAdmin.from('logen').select('id, name').eq('name', 'Einhorn Schloss').single()

  if (!standort || !loge) {
    console.error('Standort oder Loge "Einhorn Schloss" nicht gefunden.')
    process.exit(1)
  }
  console.log('Teste mit Loge:', loge.name, loge.id)

  const { data: kunde1, error: kundeFehler1 } = await supabaseAdmin
    .from('kunden')
    .insert({ standort_id: standort.id, vorname: 'TEST', nachname: 'Doppelbelegung1', telefon: TEST_TELEFON_1, dsgvo_einwilligung: true })
    .select('id').single()
  if (kundeFehler1) { console.error('Kunde 1 Fehler:', kundeFehler1.message); process.exit(1) }

  const { data: kunde2, error: kundeFehler2 } = await supabaseAdmin
    .from('kunden')
    .insert({ standort_id: standort.id, vorname: 'TEST', nachname: 'Doppelbelegung2', telefon: TEST_TELEFON_2, dsgvo_einwilligung: true })
    .select('id').single()
  if (kundeFehler2) { console.error('Kunde 2 Fehler:', kundeFehler2.message); process.exit(1) }

  const basis = {
    standort_id: standort.id,
    loge_id: loge.id,
    typ: 'GEBURTSTAG' as const,
    status: 'BESTAETIGT_AUSSTEHEND' as const,
    datum: TEST_DATUM,
    zeitslot: 2,
    erwachsene_anzahl: 3,
    paket_preis_pro_kind: 23,
    gesamtbetrag: 100,
    anzahlung_betrag: 20,
  }

  console.log('\n--- Insert 1 (6 Kinder) ---')
  const { data: res1, error: fehler1 } = await supabaseAdmin
    .from('reservierungen')
    .insert({ ...basis, kunde_id: kunde1!.id, kinder_anzahl: 6 })
    .select('id').single()
  console.log('Ergebnis 1:', res1 ? `OK, id=${res1.id}` : `FEHLER: ${fehler1?.message} (code: ${fehler1?.code})`)

  console.log('\n--- Insert 2 (8 Kinder, GLEICHE Loge/Datum/Slot) ---')
  const { data: res2, error: fehler2 } = await supabaseAdmin
    .from('reservierungen')
    .insert({ ...basis, kunde_id: kunde2!.id, kinder_anzahl: 8 })
    .select('id').single()
  console.log('Ergebnis 2:', res2 ? `OK, id=${res2.id}` : `FEHLER: ${fehler2?.message} (code: ${fehler2?.code})`)

  console.log('\n=== FAZIT ===')
  if (res1 && res2) {
    console.log('Doppelbelegung FUNKTIONIERT in der Live-Datenbank — kein UNIQUE-Constraint-Block.')
  } else if (res1 && !res2) {
    console.log('Doppelbelegung ist BLOCKIERT — zweiter Insert schlägt fehl (vermutlich UNIQUE-Constraint).')
  } else {
    console.log('Unerwarteter Zustand — bitte Fehler oben prüfen.')
  }

  await aufraeumen()
  console.log('\nTestdaten aufgeräumt.')
}

main().catch(async (err) => {
  console.error('Unerwarteter Fehler:', err)
  await aufraeumen()
  process.exit(1)
})
