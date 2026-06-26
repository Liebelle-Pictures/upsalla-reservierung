import { stripe } from './client'
import type Stripe from 'stripe'

export function konstruiereEvent(
  payload: string | Buffer,
  signatur: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signatur,
    process.env.STRIPE_WEBHOOK_SECRET!,
  )
}
