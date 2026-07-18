import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sheetKompletSynchronisieren } from '@/lib/google/sheets'

export const dynamic = 'force-dynamic'

// POST /api/cron/sheets-sync — wöchentliche Synchronisation aller Kunden mit Google Sheets
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }

  // Alle Kunden mit Email + letzte Reservierung laden
  const { data: kunden, error } = await supabaseAdmin
    .from('kunden')
    .select(`
      vorname, nachname, telefon, email, kind_geburtstag,
      reservierungen(datum, logen(name))
    `)
    .not('email', 'is', null)
    .order('erstellt_am', { ascending: false })

  if (error) {
    console.error('[Sheets-Sync] DB-Fehler:', error)
    return NextResponse.json({ fehler: 'Datenbankfehler' }, { status: 500 })
  }

  if (!kunden || kunden.length === 0) {
    return NextResponse.json({ synchronisiert: 0 })
  }

  console.log(`[Sheets-Sync] ${kunden.length} Kunden aus DB geladen`)

  const zeilen = kunden.map(k => {
    // Letzte Reservierung finden
    const reservierungen = (k.reservierungen ?? []) as unknown as { datum: string; logen: { name: string } | null }[]
    const letzteRes = reservierungen.sort((a, b) => b.datum.localeCompare(a.datum))[0]

    return {
      vorname: k.vorname,
      nachname: k.nachname,
      telefon: k.telefon ?? '',
      email: k.email!,
      kindGeburtstag: k.kind_geburtstag ?? null,
      letzteReservierung: letzteRes?.datum
        ? new Date(letzteRes.datum + 'T00:00:00').toLocaleDateString('de-DE')
        : null,
      logeName: (letzteRes?.logen as { name: string } | null)?.name ?? null,
    }
  })

  console.log('[Sheets-Sync] Starte Google Sheets Sync...')
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout nach 25s')), 25000)
    )
    await Promise.race([sheetKompletSynchronisieren(zeilen), timeout])
  } catch (err) {
    console.error('[Sheets-Sync] Google Sheets Fehler:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ fehler: 'Google Sheets Fehler', details: msg }, { status: 500 })
  }

  console.log(`[Sheets-Sync] ${zeilen.length} Kunden synchronisiert`)
  return NextResponse.json({ synchronisiert: zeilen.length })
}
