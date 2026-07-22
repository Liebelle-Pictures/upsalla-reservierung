import Stripe from 'stripe'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia' as any,
})

export interface AnzahlungsSessionParams {
  betragCent: number
  reservierungId: string
  beschreibung: string
  kundenEmail?: string
}

export async function erstelleAnzahlungsSession(
  params: AnzahlungsSessionParams,
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
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
    metadata: { reservierung_id: params.reservierungId },
    customer_email: params.kundenEmail ?? undefined,
    // Stornierungsbedingungen direkt auf der Checkout-Seite — rechtlich informiert vor Zahlung
    custom_text: {
      submit: {
        message: '── STORNIERUNGSBEDINGUNGEN ──\n✓ Kostenloser Storno bis 7 Tage vor dem Termin — Anzahlung wird vollständig erstattet.\n✗ Storno unter 7 Tagen — Anzahlung verfällt.\n✓ Ausnahme: Krankheit des Kindes mit ärztlichem Attest (Vorlage am selben Tag der Stornierung).',
      },
    },
    success_url: `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/zahlung/abgebrochen`,
  })

  return session.url!
}

// Vollständige Rückerstattung der Anzahlung via Stripe
export async function erstelleRueckerstattung(paymentIntentId: string): Promise<void> {
  await stripe.refunds.create({ payment_intent: paymentIntentId })
}
