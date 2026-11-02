import Stripe from 'stripe'
import { STORNIERUNGSBEDINGUNGEN_TEXT } from './texte'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia' as any,
})

export interface AnzahlungsSessionParams {
  betragCent: number
  reservierungId: string
  beschreibung: string
  kundenEmail?: string
  // ── Optionale Erweiterungen (Online-Buchung). Ohne sie entsteht exakt die bisherige
  // Session (Lena, Personal, Zahlungserinnerung) — Defaults NICHT ändern. ──
  // Gültigkeit in Sekunden (Stripe: 1800 bis 86400). Default 24h.
  gueltigkeitSekunden?: number
  // Default: APP_URL/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}
  successUrl?: string
  // Default: APP_URL/zahlung/abgebrochen
  cancelUrl?: string
  // Zusätzliche Metadaten. reservierung_id kann dadurch nicht überschrieben werden.
  zusatzMetadata?: Record<string, string>
  // Erlaubte Zahlarten. Ohne Angabe (Lena/Personal) entscheidet wie bisher das Stripe-Dashboard
  // — dann wird payment_method_types gar nicht gesetzt.
  zahlungsarten?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[]
}

export interface AnzahlungsSession {
  url: string
  id: string
}

// Checkout Sessions im mode=payment sind laut Stripe-API hart auf maximal 24 Stunden Gültigkeit
// begrenzt (expires_at: "30 minutes to 24 hours after Checkout Session creation") — das ist keine
// Einstellung von uns, sondern eine Stripe-Plattformgrenze. Explizit gesetzt statt sich auf
// Stripes Default zu verlassen, weil die Zahlungserinnerungs-Logik (zahlungserinnerung-Cron)
// sich exakt darauf verlässt, dass jeder Link, den wir verschicken, wirklich 24h funktioniert.
const GUELTIGKEIT_SEKUNDEN = 24 * 60 * 60

// Baut die Parameter für stripe.checkout.sessions.create. Reine Funktion (testbar ohne Stripe,
// siehe scripts/test-stripe-lena-unveraendert.ts). jetztMs nur für Tests.
export function baueAnzahlungsSessionParameter(
  params: AnzahlungsSessionParams,
  jetztMs: number = Date.now(),
): Stripe.Checkout.SessionCreateParams {
  const basisUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  return {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: params.betragCent,
          product_data: { name: params.beschreibung },
        },
        quantity: 1,
      },
    ],
    metadata: { ...(params.zusatzMetadata ?? {}), reservierung_id: params.reservierungId },
    customer_email: params.kundenEmail ?? undefined,
    expires_at: Math.floor(jetztMs / 1000) + (params.gueltigkeitSekunden ?? GUELTIGKEIT_SEKUNDEN),
    // Stornierungsbedingungen direkt auf der Checkout-Seite — rechtlich informiert vor Zahlung
    custom_text: {
      submit: {
        message: STORNIERUNGSBEDINGUNGEN_TEXT,
      },
    },
    success_url: params.successUrl ?? `${basisUrl}/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl ?? `${basisUrl}/zahlung/abgebrochen`,
    ...(params.zahlungsarten ? { payment_method_types: params.zahlungsarten } : {}),
  }
}

export async function erstelleAnzahlungsSession(
  params: AnzahlungsSessionParams,
): Promise<AnzahlungsSession> {
  const session = await stripe.checkout.sessions.create(baueAnzahlungsSessionParameter(params))

  return { url: session.url!, id: session.id }
}

// Session vorzeitig ungültig machen — genutzt bei der automatischen Stornierung wegen
// ausbleibender Zahlung, damit ein spät eintreffender Zahlungsversuch auf dem ALTEN Link nicht
// doch noch durchgeht, nachdem die Reservierung in Freizo schon storniert/der Slot freigegeben
// wurde. Wenn die Session technisch schon abgelaufen/bezahlt/ungültig ist, wirft Stripe einen
// Fehler — das ist unkritisch (Ziel bereits erreicht), deshalb hier bewusst abgefangen.
export async function verfalleSession(sessionId: string): Promise<void> {
  try {
    await stripe.checkout.sessions.expire(sessionId)
  } catch (e) {
    console.error('[Stripe] Session konnte nicht verfallen werden (vermutlich bereits abgelaufen):', e)
  }
}

// Vollständige Rückerstattung der Anzahlung via Stripe
export async function erstelleRueckerstattung(paymentIntentId: string): Promise<void> {
  await stripe.refunds.create({ payment_intent: paymentIntentId })
}
