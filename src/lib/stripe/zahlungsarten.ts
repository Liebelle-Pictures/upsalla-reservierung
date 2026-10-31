// Zahlarten für Online-Buchungen: nur SOFORT bestätigte Zahlarten, weil der Slot nur
// 30 Minuten (Hold 35) reserviert ist. SEPA-Lastschrift u.ä. melden die Zahlung erst nach
// Tagen — bis dahin könnte der Slot längst weitervergeben sein.
// card deckt Apple Pay / Google Pay mit ab (sofern im Dashboard aktiv).
// paypal und klarna nur, wenn sie im Stripe-Konto aktiv sind (sonst lehnt Stripe die Session ab).
// Lena/Personal nutzen das NICHT (dort entscheidet weiter das Dashboard).
import type Stripe from 'stripe'
import { stripe } from './client'

type Zahlart = Stripe.Checkout.SessionCreateParams.PaymentMethodType

export const PFLICHT_ZAHLART: Zahlart = 'card'
export const OPTIONALE_SOFORT_ZAHLARTEN: Zahlart[] = ['paypal', 'klarna']

const CACHE_MS = 10 * 60 * 1000
let cache: { wert: Zahlart[]; bis: number } | null = null

// Reine Funktion: aus der Liste der im Konto aktiven Zahlarten die erlaubten auswählen
export function waehleSofortZahlarten(aktiv: Set<string>): Zahlart[] {
  return [PFLICHT_ZAHLART, ...OPTIONALE_SOFORT_ZAHLARTEN.filter(z => aktiv.has(z))]
}

// Liest die Standard-Zahlartenkonfiguration des Kontos (10 Min. gecacht).
// Bei einem Fehler: nur Karte (funktioniert immer).
export async function ermittleSofortZahlarten(): Promise<Zahlart[]> {
  if (cache && cache.bis > Date.now()) return cache.wert
  let wert: Zahlart[] = [PFLICHT_ZAHLART]
  try {
    const liste = await stripe.paymentMethodConfigurations.list({ limit: 20 })
    const standard = liste.data.find(c => c.is_default && c.active) ?? liste.data.find(c => c.active)
    if (standard) {
      const felder = standard as unknown as Record<string, { available?: boolean } | undefined>
      const aktiv = new Set(OPTIONALE_SOFORT_ZAHLARTEN.filter(z => felder[z]?.available === true))
      wert = waehleSofortZahlarten(aktiv)
    }
  } catch (e) {
    console.error('[Stripe] Zahlarten-Konfiguration nicht lesbar, nur Karte:', e)
  }
  cache = { wert, bis: Date.now() + CACHE_MS }
  return wert
}
