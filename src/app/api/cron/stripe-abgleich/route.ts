import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { zeitslotZeitraum } from '@/lib/utils/zeitslots'

export const dynamic = 'force-dynamic'

// Upsalla-Fall (19.10.2026): Kunde hat über Lena/Freizo bezahlt, die Reservierung blieb trotzdem
// unbezahlt/storniert in Freizo stehen. Untersuchung ergab: Stripe bestätigte die Zahlung, unser
// Webhook (/api/webhooks/stripe) hat sie aber nicht verarbeitet — bei 3 von 214 echten Zahlungen
// (ca. 1,4%), über mehrere Monate verteilt, kein gemeinsames Muster erkennbar (vermutlich
// vereinzelte transiente Fehler, nicht ein deterministischer Bug). Da sich die genaue Ursache
// nicht abschließend klären ließ, ist dieser taegliche Abgleich die robustere Absicherung: er
// macht das System selbstheilend, UNABHÄNGIG davon, warum ein einzelner Webhook-Versuch
// fehlschlägt. Schaut 7 Tage zurück (reicht, um jeden Ausfall binnen max. 1 Tag zu fangen),
// korrigiert den Status und schickt die Bestätigungs-SMS nach, falls sie nie rausging.
const RUECKBLICK_TAGE = 7
const STAFF_EMAIL = 'upsalla.reservierung@gmail.com'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }

  const { stripe } = await import('@/lib/stripe/client')
  const seit = Math.floor(Date.now() / 1000) - RUECKBLICK_TAGE * 24 * 60 * 60

  const sessions: Array<{ id: string; payment_intent: string | null; metadata: Record<string, string> | null }> = []
  let startingAfter: string | undefined
  do {
    const page = await stripe.checkout.sessions.list({ limit: 100, created: { gte: seit }, starting_after: startingAfter })
    for (const s of page.data) {
      if (s.payment_status === 'paid' && s.metadata?.reservierung_id) {
        sessions.push({ id: s.id, payment_intent: s.payment_intent as string | null, metadata: s.metadata })
      }
    }
    startingAfter = page.has_more ? page.data[page.data.length - 1].id : undefined
  } while (startingAfter)

  const korrigiert: string[] = []

  for (const s of sessions) {
    const reservierungId = s.metadata!.reservierung_id
    const { data: res } = await supabaseAdmin
      .from('reservierungen')
      .select('id, status, datum, zeitslot, kinder_anzahl, erwachsene_anzahl, gesamtbetrag, anzahlung_betrag, kunden(vorname, telefon)')
      .eq('id', reservierungId)
      .maybeSingle()

    if (!res || res.status === 'BESTAETIGT_BEZAHLT') continue

    await supabaseAdmin
      .from('reservierungen')
      .update({ status: 'BESTAETIGT_BEZAHLT', stripe_payment_intent_id: s.payment_intent })
      .eq('id', reservierungId)

    korrigiert.push(reservierungId)
    console.error(`[Stripe-Abgleich] Webhook hat ${reservierungId} nie verarbeitet (Session ${s.id}) - automatisch korrigiert`)

    // Bestätigungs-SMS nachholen — der Kunde hat ggf. nie erfahren, dass die Zahlung
    // angekommen ist, weil genau dieser Schritt im kaputten Webhook-Lauf fehlte.
    const kundeRaw = res.kunden
    const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string; telefon: string | null } | null
    if (kunde?.telefon) {
      try {
        const datumAnzeige = new Date(res.datum + 'T00:00:00').toLocaleDateString('de-DE', {
          weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
        })
        const weekend = await istPreisteuerterTag(new Date(res.datum + 'T00:00:00'))
        const { start, ende } = zeitslotZeitraum(res.zeitslot, weekend)
        const restbetrag = (Number(res.gesamtbetrag) - Number(res.anzahlung_betrag)).toFixed(2)
        await sendeSMS(
          kunde.telefon,
          `Hallo ${kunde.vorname}! Eure Anzahlung ist eingegangen - der Termin am ${datumAnzeige} (${start}-${ende} Uhr) ist fix! Restbetrag von ${restbetrag} € bitte am Tag der Feier vor Ort bezahlen. Bis bald!`,
        )
      } catch (e) {
        console.error('[Stripe-Abgleich] Nachhol-SMS fehlgeschlagen:', e)
      }
    }
  }

  if (korrigiert.length > 0) {
    try {
      const { sendeEmail } = await import('@/lib/resend/client')
      await sendeEmail({
        an: STAFF_EMAIL,
        betreff: `⚠️ ${korrigiert.length} Zahlung${korrigiert.length !== 1 ? 'en' : ''} automatisch nachgetragen — Upsalla`,
        html: `<p>Der tägliche Stripe-Abgleich hat ${korrigiert.length} Reservierung(en) gefunden, bei denen die Zahlung bei Stripe einging, aber der Webhook sie nie verarbeitet hatte. Status wurde automatisch korrigiert, Kunde per SMS benachrichtigt.</p><p>Reservierungs-IDs: ${korrigiert.join(', ')}</p><p>Bitte in Freizo kurz prüfen: freizo.app/reservierungen</p>`,
      })
    } catch (e) {
      console.error('[Stripe-Abgleich] Staff-Benachrichtigung fehlgeschlagen:', e)
    }
  }

  return NextResponse.json({ geprueft: sessions.length, korrigiert: korrigiert.length, ids: korrigiert })
}
