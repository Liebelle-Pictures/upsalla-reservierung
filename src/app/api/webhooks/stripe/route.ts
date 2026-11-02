import { NextRequest, NextResponse } from 'next/server'
import { konstruiereEvent } from '@/lib/stripe/webhooks'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { zeitslotZeitraum } from '@/lib/utils/zeitslots'
import { beansprucheZahlungsbestaetigung } from '@/lib/stripe/zahlungsbestaetigung'

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

  // ── Online-Buchung (metadata.quelle = 'ONLINE', nur von /api/buchen/.../reservieren gesetzt).
  // Lena-/Personal-Sessions haben kein quelle-Feld und laufen unverändert durch den Block darunter.
  // async_payment_succeeded: verzögerte Zahlarten (z.B. SEPA), dort kommt completed mit 'unpaid'.
  if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')
    && event.data.object.metadata?.quelle === 'ONLINE') {
    const session = event.data.object
    const reservierungId = session.metadata?.reservierung_id
    if (reservierungId && session.payment_status === 'paid') {
      const { markiereOnlineBuchungBezahlt, bestaetigeOnlineBuchung } = await import('@/lib/online-buchung/bestaetigung')
      const ergebnis = await markiereOnlineBuchungBezahlt(reservierungId, (session.payment_intent as string) ?? null, new Date(event.created * 1000))
      // Bei FEHLER 500 → Stripe wiederholt den Webhook (zusätzlich fängt der Cron stripe-abgleich es auf)
      if (ergebnis === 'FEHLER') return NextResponse.json({ fehler: 'Verarbeitung fehlgeschlagen' }, { status: 500 })
      // Online-Buchungen: E-Mail des Bestandskunden wird NICHT überschrieben (Doku 5.3),
      // die Bestätigung geht an die im Checkout angegebene Adresse.
      if (ergebnis !== 'KEINE_ONLINE_BUCHUNG') await bestaetigeOnlineBuchung(reservierungId, session.customer_details?.email ?? null)
    }
    return NextResponse.json({ erhalten: true })
  }

  // Abgelaufene Session: nur unbezahlte ONLINE-Buchungen mit genau dieser Session werden frei-
  // gegeben. Lena-Links (24h) und vom Zahlungserinnerungs-Cron verfallene Sessions lösen dieses
  // Event ebenfalls aus — sie werden durch die Bedingungen in storniereUnbezahlteOnlineBuchung
  // nie verändert (kein Update, keine SMS).
  // async_payment_failed: verzögerte Zahlung endgültig gescheitert (Online-Sessions erlauben nur
  // Sofort-Zahlarten, das ist also nur ein Sicherheitsnetz). Gleiche Bedingungen, keine SMS.
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object
    const reservierungId = session.metadata?.reservierung_id
    if (reservierungId && session.metadata?.quelle === 'ONLINE') {
      const { storniereUnbezahlteOnlineBuchung } = await import('@/lib/online-buchung/bestaetigung')
      const storniert = await storniereUnbezahlteOnlineBuchung(reservierungId, session.id)
      if (storniert) console.log(`[Stripe Webhook] Online-Buchung ${reservierungId} freigegeben (${event.type === 'checkout.session.expired' ? 'Session abgelaufen' : 'Zahlung fehlgeschlagen'})`)
    }
    return NextResponse.json({ erhalten: true })
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

      const { data: res } = await supabaseAdmin
        .from('reservierungen')
        .select('kunde_id, datum, zeitslot, kinder_anzahl, erwachsene_anzahl, gesamtbetrag, anzahlung_betrag, kunden(vorname, nachname, telefon, email), logen(name)')
        .eq('id', reservierungId)
        .single()

      if (res?.kunde_id) {
        // Nur EIN Weg (Webhook / Erfolgsseite / Abgleich-Cron) sendet SMS/E-Mail — auch wenn
        // Stripe dieses Event mehrfach liefert. Status und E-Mail-Übernahme laufen trotzdem immer.
        const darfSenden = await beansprucheZahlungsbestaetigung(reservierungId, 'Webhook')
        const kunde = (Array.isArray(res.kunden) ? res.kunden[0] : res.kunden) as { vorname: string; nachname: string; telefon: string | null; email: string | null } | null
        const logeRaw = res.logen
        const loge = (Array.isArray(logeRaw) ? logeRaw[0] : logeRaw) as unknown as { name: string } | null
        const logeName = loge?.name ?? 'Loge'
        const datumAnzeige = new Date(res.datum + 'T00:00:00').toLocaleDateString('de-DE', {
          weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
        })
        const weekend = await istPreisteuerterTag(new Date(res.datum + 'T00:00:00'))
        const { start, ende } = zeitslotZeitraum(res.zeitslot, weekend)
        const restbetrag = (Number(res.gesamtbetrag) - Number(res.anzahlung_betrag)).toFixed(2)

        // Zahlungsbestätigung per SMS — inkl. Restbetrag, der am Tag der Reservierung
        // vor Ort fällig ist (auf Wunsch von Upsalla).
        if (darfSenden && kunde?.telefon) {
          try {
            const { sendeSMS } = await import('@/lib/twilio/client')
            // Bindestrich statt Gedankenstrich/Halbgeviertstrich — "—"/"–" gehören nicht zum
            // GSM-7-Alphabet und zwingen die gesamte SMS auf UCS-2 (67 statt 153 Zeichen pro
            // Segment), was die Twilio-Kosten etwa verdoppelt.
            await sendeSMS(
              kunde.telefon,
              `Hallo ${kunde.vorname}! Eure Anzahlung ist eingegangen - der Termin am ${datumAnzeige} (${start}-${ende} Uhr) ist fix! Restbetrag von ${restbetrag} € bitte am Tag der Feier vor Ort bezahlen. Bis bald!`,
            )
          } catch (err) {
            console.error('[Stripe Webhook] Zahlungsbestaetigungs-SMS fehlgeschlagen:', err)
          }
        }

        // E-Mail aus Stripe Checkout in Kundendatenbank übernehmen — Lena und Personal
        // erfragen die E-Mail meist gar nicht (fehleranfällig), Stripe verlangt sie aber
        // beim Bezahlen zwingend. Das ist für viele Buchungen die EINZIGE Gelegenheit,
        // eine gültige E-Mail zu bekommen (u.a. für die 10%-Geburtstags-Marketingmail
        // im Google-Sheet-Export).
        const stripeEmail = session.customer_details?.email
        if (stripeEmail && kunde) {
          const warEmailUnbekannt = !kunde.email

          await supabaseAdmin
            .from('kunden')
            .update({ email: stripeEmail })
            .eq('id', res.kunde_id)

          console.log(`[Stripe Webhook] E-Mail ${stripeEmail} für Kunde ${res.kunde_id} gespeichert`)

          // Buchungsbestätigung nachträglich verschicken — nur wenn wir die E-Mail vorher
          // NICHT hatten (sonst wurde die Bestätigung schon bei der Erstellung verschickt,
          // keine doppelte Mail).
          if (warEmailUnbekannt && darfSenden) {
            try {
              const { sendeEmail } = await import('@/lib/resend/client')
              const { buchungsbestaetigungHtml } = await import('@/lib/resend/templates')
              const { erzeugeReservierungICS } = await import('@/lib/utils/ics')

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
