import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'

export const dynamic = 'force-dynamic'

// POST /api/lena/reservierungen/aendern — Reservierung ändern
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const raw = await request.json().catch(() => ({}))
  const body = (raw.args ?? raw) as {
    id: string
    datum?: string
    zeitslot?: number
    kinder_anzahl?: number
    erwachsene_anzahl?: number
    notizen?: string
  }
  if (!body.id) return NextResponse.json({ hinweis: 'Reservierungs-ID fehlt. Bitte zuerst find_reservation aufrufen.' })

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, zeitslot, kinder_anzahl, erwachsene_anzahl, notizen, status')
    .eq('id', body.id)
    .single()

  if (!reservierung) return NextResponse.json({ fehler: 'Reservierung nicht gefunden' }, { status: 404 })
  if (reservierung.status === 'STORNIERT') return NextResponse.json({ fehler: 'Stornierte Reservierung kann nicht geaendert werden' }, { status: 400 })

  const neuesDatum = body.datum ?? reservierung.datum
  const kinderAnzahl = body.kinder_anzahl ?? reservierung.kinder_anzahl
  const erwachseneAnzahl = body.erwachsene_anzahl ?? reservierung.erwachsene_anzahl ?? 0
  const teuerterTag = await istPreisteuerterTag(new Date(neuesDatum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, teuerterTag, erwachseneAnzahl)
  const anzahlungBetrag = berechneAnzahlung(gesamtbetrag)

  const updates: Record<string, unknown> = {
    kinder_anzahl: kinderAnzahl,
    erwachsene_anzahl: erwachseneAnzahl,
    gesamtbetrag,
    anzahlung_betrag: anzahlungBetrag,
    notizen: body.notizen ?? reservierung.notizen,
    aktualisiert_am: new Date().toISOString(),
  }
  if (body.datum) updates.datum = body.datum
  if (body.zeitslot) updates.zeitslot = body.zeitslot

  await supabaseAdmin.from('reservierungen').update(updates).eq('id', body.id)

  console.log(`[change_reservation] id=${body.id} | neues Datum=${neuesDatum} | Zeitslot=${body.zeitslot ?? reservierung.zeitslot}`)
  return NextResponse.json({ erfolg: true, datum: neuesDatum, zeitslot: body.zeitslot ?? reservierung.zeitslot, gesamtbetrag, anzahlung: anzahlungBetrag })
}
