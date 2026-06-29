import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'

export const dynamic = 'force-dynamic'

function tageBisReservierung(datum: string): number {
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const reservierungsDatum = new Date(datum + 'T00:00:00')
  return Math.floor((reservierungsDatum.getTime() - heute.getTime()) / (1000 * 60 * 60 * 24))
}

// POST /api/lena/reservierungen/stornieren
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const body = await request.json().catch(() => ({}))
  const args = body.args ?? body
  const { id, attest } = args as { id: string; attest?: boolean }
  if (!id) return NextResponse.json({ hinweis: 'Reservierungs-ID fehlt. Bitte zuerst find_reservation aufrufen.' })

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, zeitslot, status, anzahlung_betrag, stripe_payment_intent_id, kunden(vorname, telefon)')
    .eq('id', id)
    .single()

  if (!reservierung) return NextResponse.json({ fehler: 'Reservierung nicht gefunden' }, { status: 404 })
  if (reservierung.status === 'STORNIERT') return NextResponse.json({ fehler: 'Bereits storniert' }, { status: 400 })

  const tage = tageBisReservierung(reservierung.datum)
  const anzahlungBezahlt = !!reservierung.stripe_payment_intent_id
  const rueckerstattung = anzahlungBezahlt && (tage >= 7 || attest === true)

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

    const smsText = rueckerstattung
      ? `Hallo ${kunde.vorname}, Ihre Reservierung bei Upsalla am ${datumAnzeige} wurde storniert. Die Anzahlung von ${Number(reservierung.anzahlung_betrag).toFixed(2)} EUR wird in 5-10 Werktagen erstattet.`
      : `Hallo ${kunde.vorname}, Ihre Reservierung bei Upsalla am ${datumAnzeige} wurde storniert. Gemaess unserer Stornobedingungen kann die Anzahlung leider nicht erstattet werden.`

    await sendeSMS(kunde.telefon, smsText)
  }

  return NextResponse.json({
    erfolg: true,
    rueckerstattung,
    betrag: rueckerstattung ? reservierung.anzahlung_betrag : 0,
    hinweis: rueckerstattung
      ? `Bitte Rueckerstattung von ${Number(reservierung.anzahlung_betrag).toFixed(2)} EUR manuell in Stripe veranlassen. Payment Intent: ${reservierung.stripe_payment_intent_id}`
      : 'Keine Rueckerstattung gemaess Stornobedingungen.',
  })
}
