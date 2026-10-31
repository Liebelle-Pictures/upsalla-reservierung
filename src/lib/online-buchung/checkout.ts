// Lädt Stripe-Session + zugehörige Online-Buchung für die Seiten erfolg/abgebrochen.
// Gibt nur etwas zurück, wenn Session, Reservierung und Standort zusammenpassen —
// fremde oder Lena-Sessions zeigen nichts an.
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { zeitslotZeitraum } from '@/lib/utils/zeitslots'

export interface OnlineCheckout {
  session: Stripe.Checkout.Session
  reservierung: {
    id: string
    status: string
    datum: string
    zeitslot: number
    kinder_anzahl: number
    erwachsene_anzahl: number
    gesamtbetrag: number
    anzahlung_betrag: number
    logeName: string
  }
  // Für die Anzeige
  datumAnzeige: string
  uhrzeit: string
}

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/

export async function ladeOnlineCheckout(standortId: string, sessionId: string | undefined): Promise<OnlineCheckout | null> {
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) return null
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (e) {
    console.error('[Online-Buchung] Session laden fehlgeschlagen:', e)
    return null
  }
  const reservierungId = session.metadata?.reservierung_id
  if (session.metadata?.quelle !== 'ONLINE' || !reservierungId) return null

  const { data: res } = await supabaseAdmin
    .from('reservierungen')
    .select('id, status, standort_id, datum, zeitslot, kinder_anzahl, erwachsene_anzahl, gesamtbetrag, anzahlung_betrag, logen(name)')
    .eq('id', reservierungId)
    .eq('angenommen_von', 'ONLINE')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (!res || res.standort_id !== standortId) return null

  const loge = (Array.isArray(res.logen) ? res.logen[0] : res.logen) as { name: string } | null
  const weekend = await istPreisteuerterTag(new Date(res.datum + 'T00:00:00'))
  const { start, ende } = zeitslotZeitraum(res.zeitslot, weekend)
  return {
    session,
    reservierung: {
      id: res.id,
      status: res.status,
      datum: res.datum,
      zeitslot: res.zeitslot,
      kinder_anzahl: res.kinder_anzahl,
      erwachsene_anzahl: res.erwachsene_anzahl,
      gesamtbetrag: Number(res.gesamtbetrag),
      anzahlung_betrag: Number(res.anzahlung_betrag),
      logeName: loge?.name ?? 'Loge',
    },
    datumAnzeige: new Date(res.datum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    uhrzeit: `${start}–${ende} Uhr`,
  }
}

export function euro(betrag: number): string {
  return `${betrag.toFixed(2).replace('.', ',')} €`
}
