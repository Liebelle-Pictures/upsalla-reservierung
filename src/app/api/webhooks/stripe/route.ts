import { NextRequest, NextResponse } from 'next/server'
import { konstruiereEvent } from '@/lib/stripe/webhooks'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
  } catch {
    return NextResponse.json({ fehler: 'Ungültige Signatur' }, { status: 400 })
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
    }
  }

  return NextResponse.json({ erhalten: true })
}
