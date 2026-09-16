import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Aus Manuelle_Nacherfassung.csv — Name, Telefon (falls vorhanden), Datum
const LISTE = [
  { name: 'Emily Rotzhe', telefon: '', datum: '2026-09-01' },
  { name: 'Eida Jachel', telefon: '', datum: '2026-09-01' },
  { name: 'Adrian Moretz', telefon: '0157 85321616', datum: '2026-09-05' },
  { name: 'Tino Scaperduti', telefon: '0157 54547075', datum: '2026-09-12' },
  { name: 'Tarek El Masri', telefon: '0170 3462961', datum: '2026-09-13' },
  { name: 'Alma De Fontaine', telefon: '0172 5788672', datum: '2026-09-15' },
  { name: 'Monika', telefon: '0176 21622124', datum: '2026-09-19' },
  { name: 'Melina Östchim', telefon: '0176 60453892', datum: '2026-09-21' },
  { name: 'Amira El Us Ruti', telefon: '0173 6764400', datum: '2026-09-21' },
  { name: 'Mila Mäger', telefon: '0177 3101060', datum: '2026-10-03' },
  { name: 'Assis Rauf', telefon: '0151 14240677', datum: '2026-10-04' },
  { name: 'Lumi Schmidt', telefon: '0152 53888809', datum: '2026-10-09' },
  { name: 'Frau Kapocha', telefon: '0173 2967459', datum: '2026-10-21' },
  { name: 'Tunsch', telefon: '', datum: '2026-10-26' },
  { name: 'Ali Miran Rena', telefon: '', datum: '2026-10-26' },
]

async function main() {
  console.log(`Suche ${LISTE.length} Einträge...\n`)
  const gefunden: Array<{ id: string; status: string; angenommen_von: string; anzahlung_betrag: number }> = []
  const nichtGefunden: string[] = []

  for (const eintrag of LISTE) {
    let treffer: { id: string; datum: string; status: string; angenommen_von: string; anzahlung_betrag: number; kunden: { vorname: string; nachname: string; telefon: string } | null }[] | null = null

    if (eintrag.telefon) {
      const { data: kunde } = await supabaseAdmin.from('kunden').select('id').eq('telefon', eintrag.telefon.trim()).maybeSingle()
      if (kunde) {
        const { data } = await supabaseAdmin
          .from('reservierungen')
          .select('id, datum, status, angenommen_von, anzahlung_betrag, kunden(vorname, nachname, telefon)')
          .eq('kunde_id', kunde.id)
        treffer = data as typeof treffer
      }
    } else {
      const [vorname, ...rest] = eintrag.name.split(' ')
      const { data } = await supabaseAdmin
        .from('reservierungen')
        .select('id, datum, status, angenommen_von, anzahlung_betrag, kunden!inner(vorname, nachname, telefon)')
        .eq('datum', eintrag.datum)
        .ilike('kunden.vorname', vorname)
      treffer = data as typeof treffer
      void rest
    }

    if (!treffer || treffer.length === 0) {
      nichtGefunden.push(`${eintrag.name} (${eintrag.datum})`)
      continue
    }

    for (const t of treffer) {
      console.log(`✓ ${eintrag.name} → ${t.datum} | status=${t.status} | angenommen_von="${t.angenommen_von}" | anzahlung=${t.anzahlung_betrag} | id=${t.id}`)
      gefunden.push({ id: t.id, status: t.status, angenommen_von: t.angenommen_von, anzahlung_betrag: t.anzahlung_betrag })
    }
  }

  console.log(`\n${gefunden.length} gefunden, ${nichtGefunden.length} nicht gefunden.`)
  if (nichtGefunden.length) console.log('Nicht gefunden:', nichtGefunden.join(', '))

  console.log('\nIDs (für Update-Skript):')
  console.log(JSON.stringify(gefunden.map(g => g.id)))
}

main().catch(err => { console.error(err); process.exit(1) })
