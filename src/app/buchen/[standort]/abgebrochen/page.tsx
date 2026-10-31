// Rückkehr von Stripe über "Zurück" (cancel_url der Online-Buchung): Session sofort
// verfallen lassen und den Slot freigeben, statt 35 Minuten zu blockieren.
// Ist inzwischen doch bezahlt worden, wird nichts storniert (→ Erfolgsseite).
import { notFound, redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe/client'
import { ladeOnlineStandort } from '@/lib/online-buchung/standort'
import { ladeOnlineCheckout } from '@/lib/online-buchung/checkout'
import { storniereUnbezahlteOnlineBuchung } from '@/lib/online-buchung/bestaetigung'
import { StatusKarte, KnopfLink } from '@/components/buchen/StatusKarte'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Zahlung abgebrochen · Upsalla Kinderpark Wuppertal', robots: { index: false } }

export default async function AbgebrochenPage(props: PageProps<'/buchen/[standort]/abgebrochen'>) {
  const { standort: slug } = await props.params
  const { session_id } = await props.searchParams
  const standort = await ladeOnlineStandort(slug)
  if (!standort) notFound()

  const sessionId = typeof session_id === 'string' ? session_id : undefined
  const checkout = await ladeOnlineCheckout(standort.id, sessionId)
  const erfolgUrl = `/buchen/${standort.slug}/erfolg?session_id=${encodeURIComponent(sessionId ?? '')}`

  if (checkout) {
    const { session, reservierung: r } = checkout
    if (session.payment_status === 'paid' || session.status === 'complete') redirect(erfolgUrl)

    let abgelaufen = session.status === 'expired'
    if (session.status === 'open') {
      try {
        await stripe.checkout.sessions.expire(session.id)
        abgelaufen = true
      } catch (e) {
        // Schlägt fehl, wenn die Session gerade bezahlt wurde → nichts stornieren
        console.error('[Online-Buchung] Session verfallen lassen fehlgeschlagen:', e)
        const aktuell = await stripe.checkout.sessions.retrieve(session.id)
        if (aktuell.payment_status === 'paid' || aktuell.status === 'complete') redirect(erfolgUrl)
        abgelaufen = aktuell.status === 'expired'
      }
    }
    if (abgelaufen && r.status === 'BESTAETIGT_AUSSTEHEND') {
      await storniereUnbezahlteOnlineBuchung(r.id, session.id)
    }
  }

  return (
    <StatusKarte ton="hinweis" titel="Zahlung abgebrochen">
      <p>Ihr habt die Zahlung abgebrochen, es wurde nichts abgebucht. Der Termin ist nicht gebucht.</p>
      <p>Wählt einfach einen neuen Termin, wenn ihr möchtet.</p>
      <KnopfLink href={`/buchen/${standort.slug}`}>Neuen Termin wählen</KnopfLink>
    </StatusKarte>
  )
}
