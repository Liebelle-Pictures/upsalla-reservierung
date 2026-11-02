import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { getSchliesstagName } from '@/lib/utils/zeitslots'
import { berechneVerfuegbarkeit } from '@/lib/verfuegbarkeit'
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

  const ergebnis = await berechneVerfuegbarkeit({ standortId: WUPPERTAL_STANDORT_ID, datum, modus: 'LENA' })

  if (ergebnis.geschlossen) {
    return NextResponse.json({
      datum,
      geschlossen: true,
      verfuegbar: [],
      hinweis: `Der Park hat an diesem Tag geschlossen (${getSchliesstagName(new Date(datum + 'T00:00:00'))}). Bitte ein anderes Datum vorschlagen.`,
    })
  }

  const { teuerterTag, preisTyp, verfuegbar } = ergebnis

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
