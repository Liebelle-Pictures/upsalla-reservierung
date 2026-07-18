import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'

export const dynamic = 'force-dynamic'

// PATCH /api/lena/reservierungen/[id] — Reservierung ändern
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const { id } = await params

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('*, kunden(vorname, telefon)')
    .eq('id', id)
    .single()

  if (!reservierung) {
    return NextResponse.json({ fehler: 'Reservierung nicht gefunden' }, { status: 404 })
  }
  if (reservierung.status === 'STORNIERT') {
    return NextResponse.json({ fehler: 'Stornierte Reservierung kann nicht geändert werden' }, { status: 400 })
  }

  const body = await request.json() as { kinder_anzahl?: number; notizen?: string }
  const kinderAnzahl = body.kinder_anzahl ?? reservierung.kinder_anzahl
  const weekend = await istPreisteuerterTag(new Date(reservierung.datum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, weekend, 0)
  const anzahlungBetrag = berechneAnzahlung(gesamtbetrag)

  await supabaseAdmin
    .from('reservierungen')
    .update({
      kinder_anzahl: kinderAnzahl,
      gesamtbetrag,
      anzahlung_betrag: anzahlungBetrag,
      notizen: body.notizen ?? reservierung.notizen,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({ erfolg: true, gesamtbetrag, anzahlung: anzahlungBetrag })
}

// DELETE /api/lena/reservierungen/[id] — Reservierung stornieren
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const { id } = await params

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, zeitslot, kunden(vorname, telefon)')
    .eq('id', id)
    .single()

  if (!reservierung) {
    return NextResponse.json({ fehler: 'Reservierung nicht gefunden' }, { status: 404 })
  }

  await supabaseAdmin
    .from('reservierungen')
    .update({ status: 'STORNIERT', aktualisiert_am: new Date().toISOString() })
    .eq('id', id)

  // Storno-SMS senden
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
