import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Vercel Cron authentifizierung
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }

  // Datum in 48 Stunden berechnen
  const in48h = new Date()
  in48h.setHours(in48h.getHours() + 48)
  const zieldatum = `${in48h.getFullYear()}-${String(in48h.getMonth() + 1).padStart(2, '0')}-${String(in48h.getDate()).padStart(2, '0')}`

  const { data: reservierungen, error } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, kinder_anzahl, gesamtbetrag, anzahlung_betrag, status, kunden(vorname, telefon)')
    .eq('datum', zieldatum)
    .in('status', ['BESTAETIGT_BEZAHLT', 'BESTAETIGT_AUSSTEHEND'])

  if (error) {
    console.error('[Reminder] Datenbankfehler:', error)
    return NextResponse.json({ fehler: 'Datenbankfehler' }, { status: 500 })
  }

  if (!reservierungen || reservierungen.length === 0) {
    return NextResponse.json({ gesendet: 0, hinweis: `Keine Reservierungen am ${zieldatum}` })
  }

  let gesendet = 0
  const fehler: string[] = []

  for (const res of reservierungen) {
    const kundeRaw = res.kunden
    const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string; telefon: string } | null

    if (!kunde?.telefon) continue

    const datumAnzeige = new Date(res.datum + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const zeitAnzeige = res.zeitslot === 1 ? '10:30–14:30' : '15:00–19:00'
    const restbetrag = (Number(res.gesamtbetrag) - Number(res.anzahlung_betrag)).toFixed(2)

    const smsText = res.status === 'BESTAETIGT_BEZAHLT'
      ? `Hallo ${kunde.vorname}! Erinnerung: Euer Geburtstag im Upsalla Kinderpark Wuppertal ist uebermorgen, ${datumAnzeige} von ${zeitAnzeige} Uhr. Bitte ${restbetrag} Euro vor Ort bezahlen. Wir freuen uns auf euch! Tel: 0202 2623339`
      : `Hallo ${kunde.vorname}! Erinnerung: Euer Geburtstag im Upsalla Kinderpark ist uebermorgen, ${datumAnzeige} von ${zeitAnzeige} Uhr. Bitte beachtet: Die Anzahlung ist noch ausstehend. Tel: 0202 2623339`

    try {
      await sendeSMS(kunde.telefon, smsText)
      gesendet++
    } catch (e) {
      fehler.push(`${kunde.telefon}: ${e}`)
    }
  }

  console.log(`[Reminder] ${zieldatum}: ${gesendet} SMS gesendet`)
  return NextResponse.json({ gesendet, datum: zieldatum, fehler })
}
