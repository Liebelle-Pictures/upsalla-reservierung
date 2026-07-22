import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getVerfuegbareSlots } from '@/lib/utils/zeitslots'
import { istPreisteuerterTag, getPreisTypLabel } from '@/lib/utils/feiertage'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'

export const dynamic = 'force-dynamic'

function normalisiertDatum(raw: string): string | null {
  if (!raw) return null
  let result: string | null = null
  // YYYY-MM-DD oder YYYY-M-D
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) result = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  // DD.MM.YYYY
  if (!result) {
    const deMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (deMatch) result = `${deMatch[3]}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`
  }
  // D. MonatName YYYY
  if (!result) {
    const monate: Record<string, string> = { januar:'01',februar:'02',märz:'03',april:'04',mai:'05',juni:'06',juli:'07',august:'08',september:'09',oktober:'10',november:'11',dezember:'12' }
    const nameMatch = raw.toLowerCase().match(/(\d{1,2})\.?\s+(\w+)\s+(\d{4})/)
    if (nameMatch && monate[nameMatch[2]]) result = `${nameMatch[3]}-${monate[nameMatch[2]]}-${nameMatch[1].padStart(2, '0')}`
  }
  if (!result) return null
  // Jahreskorrektur: LLM verwendet manchmal falsches Jahr
  const jahr = parseInt(result.slice(0, 4))
  if (jahr < 2026) result = '2026' + result.slice(4)
  return result
}

async function handleVerfuegbarkeit(datumRaw: string) {
  console.log('[check_availability] datum empfangen:', JSON.stringify(datumRaw))
  const datum = normalisiertDatum(datumRaw)
  console.log('[check_availability] datum normiert:', datum)
  if (!datum) {
    return NextResponse.json({ hinweis: 'Datum fehlt. Bitte zuerst das Datum vom Kunden erfragen, dann erneut aufrufen.' })
  }

  const datumObj = new Date(datum + 'T00:00:00')

  // Preistyp und verfügbare Slots ermitteln (inkl. Feiertage/Ferien)
  const [teuerterTag, preisTyp] = await Promise.all([
    istPreisteuerterTag(datumObj),
    getPreisTypLabel(datumObj),
  ])

  const { data: logen } = await supabaseAdmin
    .from('logen')
    .select('id, name, ist_babywelt')
    .eq('standort_id', WUPPERTAL_STANDORT_ID)
    .eq('aktiv', true)
    .order('name')

  const { data: belegt } = await supabaseAdmin
    .from('reservierungen')
    .select('loge_id, zeitslot, kinder_anzahl')
    .eq('datum', datum)
    .eq('standort_id', WUPPERTAL_STANDORT_ID)
    .neq('status', 'STORNIERT')

  // Belegungen pro Slot aggregieren
  const belegMap = new Map<string, { anzahl: number; kinder: number }>()
  for (const r of belegt ?? []) {
    const key = `${r.loge_id}-${r.zeitslot}`
    const b = belegMap.get(key) ?? { anzahl: 0, kinder: 0 }
    belegMap.set(key, { anzahl: b.anzahl + 1, kinder: b.kinder + r.kinder_anzahl })
  }

  const slots = getVerfuegbareSlots(datumObj, teuerterTag)

  const verfuegbar = (logen ?? []).flatMap((loge: { id: string; name: string; ist_babywelt: boolean }) =>
    slots.flatMap((s) => {
      const key = `${loge.id}-${s.nummer}`
      const b = belegMap.get(key)

      // Vollständig frei
      if (!b) return [{ loge_id: loge.id, loge_name: loge.name, ist_babywelt: loge.ist_babywelt, zeitslot: s.nummer, uhrzeit: `${s.start} - ${s.ende} Uhr`, teil_belegt: false, max_kinder: 20 }]

      // Bereits 2 Gruppen oder exklusive Gruppe (≥10 Kinder) → voll belegt
      if (b.anzahl >= 2 || b.kinder >= 10) return []

      // Halbe Loge frei (erste Gruppe hat <10 Kinder, Platz für 2. Gruppe)
      const maxWeitere = 20 - b.kinder
      if (maxWeitere >= 6) return [{ loge_id: loge.id, loge_name: loge.name, ist_babywelt: loge.ist_babywelt, zeitslot: s.nummer, uhrzeit: `${s.start} - ${s.ende} Uhr`, teil_belegt: true, bereits_kinder: b.kinder, max_kinder: maxWeitere }]

      return []
    })
  )

  return NextResponse.json({
    datum,
    preisTyp,
    preisProPerson: teuerterTag ? 27.0 : 23.0,
    verfuegbar,
    hinweis_doppelbelegung: 'Logen mit teil_belegt:true haben bereits eine Gruppe. Zweite Gruppe möglich wenn eigene Kinder + bereits_kinder ≤ 20 und eigene Kinder < 10. Kunden darüber informieren!',
  })
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
  // Retell sendet Argumente in body.args, nicht direkt in body
  const args = body.args ?? body
  const datumRaw = args.datum ?? request.nextUrl.searchParams.get('datum') ?? ''
  console.log('[check_availability] datum:', JSON.stringify(datumRaw))
  return handleVerfuegbarkeit(String(datumRaw))
}
