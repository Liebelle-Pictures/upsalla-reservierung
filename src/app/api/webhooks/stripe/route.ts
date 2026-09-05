import { NextRequest, NextResponse } from 'next/server'
import { konstruiereEvent } from '@/lib/stripe/webhooks'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { zeitslotZeitraum } from '@/lib/utils/zeitslots'

// Stripe sendet raw body — kein JSON-Parsing durch Next.js
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const payload = await request.text()
  const signatur = request.headers.get('stripe-signature')

  if (!signatur) {
    return NextResponse.json({ fehler: 'Keine Signatur' }, { status: 400 })
  }

  let event
  try {
    event = konstruiereEvent(payload, signatur)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Stripe Webhook] Signaturprüfung fehlgeschlagen:', msg)
    return NextResponse.json({ fehler: 'Ungültige Signatur', details: msg }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const reservierungId = session.metadata?.reservierung_id

    if (reservierungId) {
      await supabaseAdmin
        .from('reservierungen')
        .update({
          status: 'BESTAETIGT_BEZAHLT',
          stripe_payment_intent_id: session.payment_intent as string ?? null,
        })
        .eq('id', reservierungId)

      // E-Mail aus Stripe Checkout in Kundendatenbank übernehmen — Lena und Personal
      // erfragen die E-Mail meist gar nicht (fehleranfällig), Stripe verlangt sie aber
      // beim Bezahlen zwingend. Das ist für viele Buchungen die EINZIGE Gelegenheit,
      // eine gültige E-Mail zu bekommen (u.a. für die 10%-Geburtstags-Marketingmail
      // im Google-Sheet-Export).
      const stripeEmail = session.customer_details?.email
      if (stripeEmail) {
        const { data: res } = await supabaseAdmin
          .from('reservierungen')
          .select('kunde_id, datum, zeitslot, kinder_anzahl, erwachsene_anzahl, gesamtbetrag, anzahlung_betrag, kunden(vorname, nachname, email), logen(name)')
          .eq('id', reservierungId)
          .single()

        if (res?.kunde_id) {
          const kunde = (Array.isArray(res.kunden) ? res.kunden[0] : res.kunden) as { vorname: string; nachname: string; email: string | null } | null
          const warEmailUnbekannt = !kunde?.email

          await supabaseAdmin
            .from('kunden')
            .update({ email: stripeEmail })
            .eq('id', res.kunde_id)

          console.log(`[Stripe Webhook] E-Mail ${stripeEmail} für Kunde ${res.kunde_id} gespeichert`)

          // Buchungsbestätigung nachträglich verschicken — nur wenn wir die E-Mail vorher
          // NICHT hatten (sonst wurde die Bestätigung schon bei der Erstellung verschickt,
          // keine doppelte Mail).
          if (warEmailUnbekannt && kunde) {
            try {
              const { sendeEmail } = await import('@/lib/resend/client')
              const { buchungsbestaetigungHtml } = await import('@/lib/resend/templates')
              const { erzeugeReservierungICS } = await import('@/lib/utils/ics')

              const logeRaw = res.logen
              const loge = (Array.isArray(logeRaw) ? logeRaw[0] : logeRaw) as unknown as { name: string } | null
              const logeName = loge?.name ?? 'Loge'

              const datumAnzeige = new Date(res.datum + 'T00:00:00').toLocaleDateString('de-DE', {
                weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
              })
              const weekend = await istPreisteuerterTag(new Date(res.datum + 'T00:00:00'))
              const { start, ende } = zeitslotZeitraum(res.zeitslot, weekend)

              await sendeEmail({
                an: stripeEmail,
                betreff: `Buchungsbestätigung – ${datumAnzeige} · Upsalla Kinderpark Wuppertal`,
                html: buchungsbestaetigungHtml({
                  vorname: kunde.vorname,
                  nachname: kunde.nachname,
                  datum: datumAnzeige,
                  zeitslot: `Slot ${res.zeitslot} — ${start}–${ende} Uhr`,
                  logeName,
                  kinderAnzahl: res.kinder_anzahl,
                  erwachseneAnzahl: res.erwachsene_anzahl,
                  gesamtbetrag: res.gesamtbetrag,
                  anzahlungBetrag: res.anzahlung_betrag,
                  stripePaymentLink: null, // bereits bezahlt — grüne "bestätigt"-Box statt Zahlungslink
                }),
                kalenderAnhang: {
                  dateiname: 'termin.ics',
                  inhalt: erzeugeReservierungICS({
                    reservierungId, datum: res.datum, startZeit: start, endZeit: ende, logeName, vorname: kunde.vorname,
                  }),
                  methode: 'REQUEST',
                },
              })
            } catch (err) {
              console.error('[Stripe Webhook] Nachtraegliche Buchungsbestaetigung fehlgeschlagen:', err)
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ erhalten: true })
}
