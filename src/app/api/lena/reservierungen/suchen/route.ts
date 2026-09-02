import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { zeitslotZeitraum } from '@/lib/utils/zeitslots'

export const dynamic = 'force-dynamic'

// POST /api/lena/reservierungen/suchen — Reservierungen nach Telefon suchen
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const body = await request.json().catch(() => ({}))
  // Retell sendet Argumente in body.args
  const args = body.args ?? body
  console.log('[find_reservation] args:', JSON.stringify(args))

  const telefon = args.telefon ?? args.Telefon ?? args.phone ?? request.nextUrl.searchParams.get('telefon')

  if (!telefon) {
    console.log('[find_reservation] telefon fehlt, body keys:', Object.keys(body))
    return NextResponse.json({ hinweis: 'Bitte zuerst die Telefonnummer des Kunden erfragen, dann erneut aufrufen.' })
  }

  const { data: kunde } = await supabaseAdmin
    .from('kunden')
    .select('id, vorname, nachname')
    .eq('telefon', telefon)
    .maybeSingle()

  if (!kunde) {
    return NextResponse.json({ reservierungen: [] })
  }

  const heute = new Date()
  const jahr = heute.getFullYear()
  const monat = String(heute.getMonth() + 1).padStart(2, '0')
  const tag = String(heute.getDate()).padStart(2, '0')
  const heuteDatum = `${jahr}-${monat}-${tag}`

  const { data: reservierungen } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, status, typ, kinder_anzahl, logen(name)')
    .eq('kunde_id', kunde.id)
    .neq('status', 'STORNIERT')
    .gte('datum', heuteDatum)
    .order('datum', { ascending: true })

  const reservierungenFormatiert = await Promise.all((reservierungen ?? []).map(async (r: Record<string, unknown>) => {
    const weekend = await istPreisteuerterTag(new Date((r.datum as string) + 'T00:00:00'))
    const { start, ende } = zeitslotZeitraum(r.zeitslot as number, weekend)
    return {
      id: r.id,
      datum: r.datum,
      zeitslot: `${start}-${ende} Uhr`,
      status: r.status,
      typ: r.typ,
      kinder_anzahl: r.kinder_anzahl,
      loge: (r.logen as { name: string } | null)?.name,
    }
  }))

  return NextResponse.json({
    kunde: { vorname: kunde.vorname, nachname: kunde.nachname },
    reservierungen: reservierungenFormatiert,
  })
}
