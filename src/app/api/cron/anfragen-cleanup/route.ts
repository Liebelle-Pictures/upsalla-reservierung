import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Erledigte Anfragen bleiben nur 90 Tage im Archiv — danach sind sie erledigt und erledigt,
// kein Grund mehr sie aufzubewahren. Betrifft NUR status=ERLEDIGT, offene Anfragen werden nie
// angefasst (egal wie alt).
const AUFBEWAHRUNG_TAGE = 90
// Rate-Limit-Protokoll der Online-Buchung (nur gehashte IPs)
const VERSUCHE_AUFBEWAHRUNG_TAGE = 7

// GET /api/cron/anfragen-cleanup — wöchentlich: alte, erledigte Anfragen löschen
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }

  const grenze = new Date(Date.now() - AUFBEWAHRUNG_TAGE * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('kunden_anfragen')
    .delete()
    .eq('status', 'ERLEDIGT')
    .lt('erledigt_am', grenze)
    .select('id')

  if (error) {
    console.error('[Anfragen-Cleanup] DB-Fehler:', error)
    return NextResponse.json({ fehler: 'Datenbankfehler' }, { status: 500 })
  }

  const geloescht = data?.length ?? 0
  console.log(`[Anfragen-Cleanup] ${geloescht} erledigte Anfragen älter als ${AUFBEWAHRUNG_TAGE} Tage gelöscht`)

  // Online-Buchung: Rate-Limit-Protokoll (gehashte IPs) nach 7 Tagen löschen (DSGVO, Datensparsamkeit).
  // Fehler hier beeinflussen die Anfragen-Bereinigung nicht.
  const versucheGrenze = new Date(Date.now() - VERSUCHE_AUFBEWAHRUNG_TAGE * 24 * 60 * 60 * 1000).toISOString()
  const { count: versucheGeloescht, error: versucheErr } = await supabaseAdmin
    .from('online_buchung_versuche')
    .delete({ count: 'exact' })
    .lt('erstellt_am', versucheGrenze)
  if (versucheErr) console.error('[Anfragen-Cleanup] Online-Buchungsversuche löschen fehlgeschlagen:', versucheErr.message)
  else console.log(`[Anfragen-Cleanup] ${versucheGeloescht ?? 0} Online-Buchungsversuche älter als ${VERSUCHE_AUFBEWAHRUNG_TAGE} Tage gelöscht`)

  return NextResponse.json({ geloescht, versuche_geloescht: versucheErr ? null : (versucheGeloescht ?? 0) })
}
