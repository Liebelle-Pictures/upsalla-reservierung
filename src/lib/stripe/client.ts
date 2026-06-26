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
    success_url: `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/reservierungen/${params.reservierungId}?zahlung=erfolg`,
    cancel_url: `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/reservierungen/${params.reservierungId}?zahlung=abgebrochen`,
  })

  return session.url!
}
