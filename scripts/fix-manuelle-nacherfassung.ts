import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const WUPPERTAL = '00000000-0000-0000-0000-000000000001'
const ANGENOMMEN_VON = 'Personal (Nacherfassung)'
const ALI_KUNDE_ID = '1ec3f869-c971-4e08-8ee2-77d4d1fb0dc8'

async function main() {
  // 1) Neue, entwirrte Kunden anlegen
  const { data: eida, error: e1 } = await supabaseAdmin
    .from('kunden')
    .insert({ standort_id: WUPPERTAL, vorname: 'Eida', nachname: 'Jachel', telefon: 'KEIN-TEL-EIDA-JACHEL', dsgvo_einwilligung: true, newsletter_opt_in: false })
    .select('id').single()
  if (e1) throw e1
  console.log('Kunde angelegt: Eida Jachel', eida.id)

  const { data: alma, error: e2 } = await supabaseAdmin
    .from('kunden')
    .insert({ standort_id: WUPPERTAL, vorname: 'Alma', nachname: 'De Fontaine', telefon: '0172 5788672', dsgvo_einwilligung: true, newsletter_opt_in: false })
    .select('id').single()
  if (e2) throw e2
  console.log('Kunde angelegt: Alma De Fontaine', alma.id)

  const { data: tunsch, error: e3 } = await supabaseAdmin
    .from('kunden')
    .insert({ standort_id: WUPPERTAL, vorname: 'Tunsch', nachname: '-', telefon: 'KEIN-TEL-TUNSCH', dsgvo_einwilligung: true, newsletter_opt_in: false })
    .select('id').single()
  if (e3) throw e3
  console.log('Kunde angelegt: Tunsch', tunsch.id)

  // 2) Ali Miran Rena — Platzhalter-Telefon weg vom irreführenden "123456789"
  const { error: e4 } = await supabaseAdmin
    .from('kunden')
    .update({ telefon: 'KEIN-TEL-ALI-MIRAN-RENA' })
    .eq('id', ALI_KUNDE_ID)
  if (e4) throw e4
  console.log('Kunde aktualisiert: Ali Miran Rena — Telefon entwirrt')

  // 3) Reservierungen auf die richtigen (neuen) Kunden umhängen
  const umhaengen: Array<[string, string]> = [
    ['b41b2cd1-96ff-4959-a019-1621191a2a4a', eida.id],   // 01.09 Einhorn Schloss → Eida Jachel
    ['b36bc115-f22a-4247-8e74-71854b727a26', alma.id],   // 15.09 Anna & Elsa → Alma De Fontaine
    ['3a3df566-eb11-41ff-bab1-a9ad89451b04', tunsch.id], // 26.10 BBQ Zelt intern → Tunsch
  ]
  for (const [resId, kundeId] of umhaengen) {
    const { error } = await supabaseAdmin.from('reservierungen').update({ kunde_id: kundeId }).eq('id', resId)
    if (error) throw error
  }
  console.log('3 Reservierungen umgehängt.')

  // 4) Zahlungsstatus + Zuordnung korrigieren (alle außer Tunsch-Sperrung und Frau Kapocha)
  const vollKorrektur = [
    'd04962ba-7d21-442f-9e0c-2391c965f2a8', // Emily Rotzhe
    'b41b2cd1-96ff-4959-a019-1621191a2a4a', // Eida Jachel
    'e6a16895-552f-4a76-9671-773e2a97fa4c', // Adrian Moretz
    '876d9923-d776-4184-94c7-a8068f2043f8', // Tino Scaperduti
    '6ec0da4f-b613-49c2-bfff-2f7e04e7b827', // Tarek El Masri
    'b36bc115-f22a-4247-8e74-71854b727a26', // Alma De Fontaine
    '3205c667-6d71-4e35-91ca-c94035595d20', // Monika
    '2211a1e7-ac6a-4f21-85ef-47670c35bf2d', // Melina Östchim
    'c38d9622-a2ba-488d-83c0-e1a17045293f', // Amira El Us Ruti
    'e560461f-8640-4e00-adbb-cb9488d42986', // Mila Mäger
    'f417afa2-6b74-4901-99b4-e6d1f554cd4a', // Assis Rauf
    'be1a9359-bdeb-40ef-9bba-39883b5b0447', // Lumi Schmidt
    '329a5d30-25c7-4079-8adb-5c2e63ed9e74', // Ali Miran Rena (Babywelt Junge)
    '48a8b952-f34a-4cf5-a6ba-4512f465a41d', // Ali Miran Rena (Babywelt Märchen)
  ]

  for (const id of vollKorrektur) {
    const { data: aktuell } = await supabaseAdmin.from('reservierungen').select('angenommen_von').eq('id', id).single()
    const update: Record<string, unknown> = { status: 'BESTAETIGT_BEZAHLT', anzahlung_betrag: 0 }
    // "Valeriu" (bereits korrekt manuell gesetzt) nicht überschreiben
    if (aktuell?.angenommen_von === 'KI LENA') update.angenommen_von = ANGENOMMEN_VON
    const { error } = await supabaseAdmin.from('reservierungen').update(update).eq('id', id)
    if (error) throw error
  }
  console.log(`${vollKorrektur.length} Reservierungen korrigiert (Status/Anzahlung/Zuordnung).`)

  // 5) Tunsch (interne Sperrung) — nur Zuordnung korrigieren, Status/Anzahlung unangetastet
  const { error: e5 } = await supabaseAdmin
    .from('reservierungen')
    .update({ angenommen_von: ANGENOMMEN_VON })
    .eq('id', '3a3df566-eb11-41ff-bab1-a9ad89451b04')
  if (e5) throw e5
  console.log('Tunsch (interne Sperrung): nur Zuordnung korrigiert.')

  console.log('\nFertig.')
}

main().catch(err => { console.error('FEHLER:', err); process.exit(1) })
