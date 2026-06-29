import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getVerfuegbareSlots } from '@/lib/utils/zeitslots'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'

export const dynamic = 'force-dynamic'

function normalisiertDatum(raw: string): string | null {
  if (!raw) return null
  // YYYY-MM-DD (korrekt)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // YYYY-M-D (ohne Nullauffüllung)
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  // DD.MM.YYYY (deutsches Format)
  const deMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (deMatch) return `${deMatch[3]}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`
  // D. MonatName YYYY
  const monate: Record<string, string> = { januar:'01',februar:'02',märz:'03',april:'04',mai:'05',juni:'06',juli:'07',august:'08',september:'09',oktober:'10',november:'11',dezember:'12' }
  const nameMatch = raw.toLowerCase().match(/(\d{1,2})\.?\s+(\w+)\s+(\d{4})/)
  if (nameMatch && monate[nameMatch[2]]) return `${nameMatch[3]}-${monate[nameMatch[2]]}-${nameMatch[1].padStart(2, '0')}`
  return null
}

async function handleVerfuegbarkeit(datumRaw: string) {
  console.log('[check_availability] datum empfangen:', JSON.stringify(datumRaw))
  const datum = normalisiertDatum(datumRaw)
  console.log('[check_availability] datum normiert:', datum)
  if (!datum) {
    return NextResponse.json({ hinweis: 'Datum fehlt. Bitte zuerst das Datum vom Kunden erfragen, dann erneut aufrufen.' })
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
  console.log('[check_availability] body:', JSON.stringify(body))
  const datumRaw = body.datum ?? request.nextUrl.searchParams.get('datum') ?? ''
  return handleVerfuegbarkeit(String(datumRaw))
}
