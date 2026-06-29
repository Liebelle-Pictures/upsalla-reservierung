import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getVerfuegbareSlots } from '@/lib/utils/zeitslots'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'

export const dynamic = 'force-dynamic'

async function handleVerfuegbarkeit(datum: string) {
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return NextResponse.json({ hinweis: 'Bitte das Datum vom Kunden erfragen (Format: YYYY-MM-DD, Beispiel: 2026-07-15).' })
  }

  const { data: logen } = await supabaseAdmin
    .from('logen')
    .select('id, name, ist_babywelt')
    .eq('standort_id', WUPPERTAL_STANDORT_ID)
    .eq('aktiv', true)
    .order('name')

  const { data: belegt } = await supabaseAdmin
    .from('reservierungen')
    .select('loge_id, zeitslot')
    .eq('datum', datum)
    .eq('standort_id', WUPPERTAL_STANDORT_ID)
    .neq('status', 'STORNIERT')

  const belegtSet = new Set(
    (belegt ?? []).map((r: { loge_id: string; zeitslot: number }) => `${r.loge_id}-${r.zeitslot}`)
  )

  const slots = getVerfuegbareSlots(new Date(datum + 'T00:00:00'))

  const verfuegbar = (logen ?? []).flatMap((loge: { id: string; name: string; ist_babywelt: boolean }) =>
    slots
      .filter((s) => !belegtSet.has(`${loge.id}-${s.nummer}`))
      .map((s) => ({
        loge_id: loge.id,
        loge_name: loge.name,
        ist_babywelt: loge.ist_babywelt,
        zeitslot: s.nummer,
        uhrzeit: `${s.start} - ${s.ende} Uhr`,
      }))
  )

  return NextResponse.json({ datum, verfuegbar })
}

export async function GET(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth
  const datum = request.nextUrl.searchParams.get('datum') ?? ''
  return handleVerfuegbarkeit(datum)
}

export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth
  const body = await request.json().catch(() => ({}))
  const datum = body.datum ?? request.nextUrl.searchParams.get('datum') ?? ''
  return handleVerfuegbarkeit(datum)
}
