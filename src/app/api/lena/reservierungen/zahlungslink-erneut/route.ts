import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'
import { erstelleAnzahlungsSession } from '@/lib/stripe/client'
import { erstelleKurzlink } from '@/lib/utils/kurzlink'

export const dynamic = 'force-dynamic'

// POST /api/lena/reservierungen/zahlungslink-erneut — Kunde hat den ursprünglichen
// Zahlungslink verloren/vergessen (Stripe-Checkout-Sessions laufen nach 24h ab) und ruft
// erneut an. Vorher konnte Lena hier nur "das kann ich leider nicht" sagen, weil kein
// Tool existierte — dieses hier erstellt eine frische Stripe-Session und schickt den
// Kurzlink erneut per SMS.
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const body = await request.json().catch(() => ({}))
  const args = body.args ?? body
  const reservierungId = (args.id ?? args.reservierung_id) as string | undefined

  if (!reservierungId) {
    return NextResponse.json({ hinweis: 'Bitte zuerst mit find_reservation die Reservierung finden, dann die id hier verwenden.' })
  }

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, status, typ, anzahlung_betrag, kunden(vorname, telefon, email)')
    .eq('id', reservierungId)
    .single()

  if (!reservierung) {
    return NextResponse.json({ hinweis: 'Reservierung nicht gefunden.' })
  }

  if (reservierung.status === 'STORNIERT') {
    return NextResponse.json({ hinweis: 'Diese Reservierung wurde storniert, ein Zahlungslink ist nicht mehr nötig.' })
  }
  if (reservierung.status === 'BESTAETIGT_BEZAHLT') {
    return NextResponse.json({ hinweis: 'Die Anzahlung wurde bereits bezahlt, der Termin ist fix. Kein neuer Link nötig.' })
  }
  if (reservierung.typ === 'GRUPPE') {
    return NextResponse.json({ hinweis: 'Für Gruppenbuchungen ist keine Anzahlung/kein Zahlungslink nötig.' })
  }

  const kundeRaw = reservierung.kunden
  const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string; telefon: string; email: string | null } | null

  if (!kunde?.telefon) {
    return NextResponse.json({ hinweis: 'Keine Telefonnummer beim Kunden hinterlegt, SMS kann nicht verschickt werden.' })
  }

  const datumAnzeige = new Date(reservierung.datum + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  let zahlungsLink: string
  try {
    zahlungsLink = await erstelleAnzahlungsSession({
      betragCent: Math.round(reservierung.anzahlung_betrag * 100),
      reservierungId: reservierung.id,
      beschreibung: `Anzahlung Geburtstag Upsalla – ${datumAnzeige}`,
      kundenEmail: kunde.email ?? undefined,
    })
  } catch (e) {
    console.error('[Zahlungslink erneut] Stripe-Fehler:', e)
    return NextResponse.json({ hinweis: 'Zahlungslink konnte gerade nicht erstellt werden, bitte später erneut versuchen.' })
  }

  await supabaseAdmin
    .from('reservierungen')
    .update({ stripe_payment_link: zahlungsLink, aktualisiert_am: new Date().toISOString() })
    .eq('id', reservierung.id)

  let smsLink = zahlungsLink
  try {
    smsLink = await erstelleKurzlink(zahlungsLink, reservierung.id)
  } catch (e) {
    console.error('[Kurzlink] Fehler beim Erstellen, verwende langen Link:', e)
  }

  await sendeSMS(
    kunde.telefon,
    `Hallo ${kunde.vorname}! Hier ist euer Zahlungslink für den Termin am ${datumAnzeige}. Anzahlung: ${reservierung.anzahlung_betrag.toFixed(2)} Euro. Bitte hier bezahlen um den Termin zu sichern: ${smsLink}`,
  )

  return NextResponse.json({ erfolg: true, hinweis: 'Neuer Zahlungslink wurde per SMS verschickt.' })
}
