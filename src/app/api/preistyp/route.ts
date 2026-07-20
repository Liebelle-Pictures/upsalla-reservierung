import { NextRequest, NextResponse } from 'next/server'
import { istPreisteuerterTag, getPreisTypLabel } from '@/lib/utils/feiertage'

export const dynamic = 'force-dynamic'

// GET /api/preistyp?datum=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const datumStr = request.nextUrl.searchParams.get('datum')
  if (!datumStr || !/^\d{4}-\d{2}-\d{2}$/.test(datumStr)) {
    return NextResponse.json({ fehler: 'Ungültiges Datum' }, { status: 400 })
  }

  const datum = new Date(datumStr + 'T00:00:00')
  const [teuerterTag, preisTyp] = await Promise.all([
    istPreisteuerterTag(datum),
    getPreisTypLabel(datum),
  ])

  return NextResponse.json({
    datum: datumStr,
    istTeuerterTag: teuerterTag,
    preisTyp,
    preisProPerson: teuerterTag ? 27.0 : 23.0,
  })
}
