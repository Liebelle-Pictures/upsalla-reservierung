import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Erledigte Anfragen bleiben nur 90 Tage im Archiv — danach sind sie erledigt und erledigt,
// kein Grund mehr sie aufzubewahren. Betrifft NUR status=ERLEDIGT, offene Anfragen werden nie
// angefasst (egal wie alt).
const AUFBEWAHRUNG_TAGE = 90

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
  return NextResponse.json({ geloescht })
}
