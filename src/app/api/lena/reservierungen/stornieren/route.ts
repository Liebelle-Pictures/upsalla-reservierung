import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'

export const dynamic = 'force-dynamic'

// POST /api/lena/reservierungen/stornieren — Reservierung stornieren
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const { id } = await request.json() as { id: string }
  if (!id) return NextResponse.json({ fehler: 'id fehlt' }, { status: 400 })

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, zeitslot, status, kunden(vorname, telefon)')
    .eq('id', id)
    .single()

  if (!reservierung) return NextResponse.json({ fehler: 'Reservierung nicht gefunden' }, { status: 404 })
  if (reservierung.status === 'STORNIERT') return NextResponse.json({ fehler: 'Bereits storniert' }, { status: 400 })

  await supabaseAdmin
    .from('reservierungen')
    .update({ status: 'STORNIERT', aktualisiert_am: new Date().toISOString() })
    .eq('id', id)

  const kundeRaw = reservierung.kunden
  const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string; telefon: string } | null

  if (kunde?.telefon) {
    const datumAnzeige = new Date(reservierung.datum + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    })
    await sendeSMS(
      kunde.telefon,
      `Hallo ${kunde.vorname}, Ihre Reservierung bei Upsalla Kinderpark Wuppertal am ${datumAnzeige} wurde storniert. Bei Fragen rufen Sie uns an.`,
    )
  }

  return NextResponse.json({ erfolg: true })
}
