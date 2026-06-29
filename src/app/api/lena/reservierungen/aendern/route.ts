import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istWochenende } from '@/lib/utils/zeitslots'

export const dynamic = 'force-dynamic'

// POST /api/lena/reservierungen/aendern — Reservierung ändern
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const raw = await request.json().catch(() => ({}))
  const body = (raw.args ?? raw) as { id: string; kinder_anzahl?: number; notizen?: string }
  if (!body.id) return NextResponse.json({ hinweis: 'Reservierungs-ID fehlt. Bitte zuerst find_reservation aufrufen.' })

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, kinder_anzahl, notizen, status')
    .eq('id', body.id)
    .single()

  if (!reservierung) return NextResponse.json({ fehler: 'Reservierung nicht gefunden' }, { status: 404 })
  if (reservierung.status === 'STORNIERT') return NextResponse.json({ fehler: 'Stornierte Reservierung kann nicht geaendert werden' }, { status: 400 })

  const kinderAnzahl = body.kinder_anzahl ?? reservierung.kinder_anzahl
  const weekend = istWochenende(new Date(reservierung.datum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, weekend)
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
    .eq('id', body.id)

  return NextResponse.json({ erfolg: true, gesamtbetrag, anzahlung: anzahlungBetrag })
}
