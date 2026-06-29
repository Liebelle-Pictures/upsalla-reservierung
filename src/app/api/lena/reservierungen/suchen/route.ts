import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST /api/lena/reservierungen/suchen — Reservierungen nach Telefon suchen
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const body = await request.json().catch(() => ({}))
  const telefon = body.telefon ?? request.nextUrl.searchParams.get('telefon')

  if (!telefon) {
    return NextResponse.json({ fehler: 'telefon fehlt' }, { status: 400 })
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

  return NextResponse.json({
    kunde: { vorname: kunde.vorname, nachname: kunde.nachname },
    reservierungen: (reservierungen ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      datum: r.datum,
      zeitslot: r.zeitslot === 1 ? '10:30-14:30 Uhr' : '15:00-19:00 Uhr',
      status: r.status,
      typ: r.typ,
      kinder_anzahl: r.kinder_anzahl,
      loge: (r.logen as { name: string } | null)?.name,
    })),
  })
}
