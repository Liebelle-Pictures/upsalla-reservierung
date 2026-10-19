import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// TEMPORÄR — Forensik-Endpoint zur Untersuchung eines Upsalla-Falls ("Kunde hat über Lena
// bezahlt, Reservierung tauchte nie in Freizo auf"). Vergleicht ALLE bei Stripe tatsächlich
// bezahlten Checkout-Sessions (die über unsere erstelleAnzahlungsSession liefen, erkennbar an
// metadata.reservierung_id) gegen unsere DB — meldet jede Session, zu der entweder gar keine
// Reservierung existiert, oder eine existiert aber NICHT als bezahlt markiert ist. Danach wieder
// entfernen.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }

  const { stripe } = await import('@/lib/stripe/client')

  // Vierter Modus: ?session_details=cs_xxx,cs_yyy — vollständige Session inkl. payment_intent.
  const detailsParam = request.nextUrl.searchParams.get('session_details')
  if (detailsParam) {
    const ids = detailsParam.split(',').map(s => s.trim()).filter(Boolean)
    const ergebnisse = []
    for (const id of ids) {
      const s = await stripe.checkout.sessions.retrieve(id)
      ergebnisse.push({ session_id: id, payment_intent: s.payment_intent, payment_status: s.payment_status, metadata: s.metadata })
    }
    return NextResponse.json({ ergebnisse })
  }

  // Dritter Modus: ?events_for_session=cs_xxx — zeigt die Stripe-Events + Webhook-Zustellungs-
  // versuche für eine konkrete Checkout Session (Teil 3 der Untersuchung).
  const sessionParam = request.nextUrl.searchParams.get('events_for_session')
  if (sessionParam) {
    const events = await stripe.events.list({ limit: 20, type: 'checkout.session.completed' })
    const treffer = events.data.filter(e => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = e.data.object as any
      return obj.id === sessionParam
    })
    const ergebnisse = []
    for (const e of treffer) {
      const versuche = await stripe.webhookEndpoints.list({ limit: 10 })
      ergebnisse.push({ event_id: e.id, created: new Date(e.created * 1000).toISOString(), pending_webhooks: e.pending_webhooks, endpoints: versuche.data.map(w => ({ url: w.url, status: w.status })) })
    }
    return NextResponse.json({ gefunden: treffer.length, ergebnisse })
  }

  // Zweiter Modus: ?payment_intents=pi_xxx,pi_yyy — prüft nur, ob für diese konkreten
  // Payment Intents bereits eine Rückerstattung existiert (Teil 2 der Untersuchung).
  const piParam = request.nextUrl.searchParams.get('payment_intents')
  if (piParam) {
    const ids = piParam.split(',').map(s => s.trim()).filter(Boolean)
    const ergebnisse = []
    for (const id of ids) {
      const pi = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const charge = pi.latest_charge as any
      ergebnisse.push({
        payment_intent: id,
        status: pi.status,
        amount: pi.amount,
        refunded: charge?.refunded ?? false,
        amount_refunded: charge?.amount_refunded ?? 0,
      })
    }
    return NextResponse.json({ ergebnisse })
  }

  const sessions: Array<{ id: string; created: number; payment_status: string | null; metadata: Record<string, string> | null; customer_email: string | null | undefined }> = []
  let startingAfter: string | undefined
  do {
    const page = await stripe.checkout.sessions.list({ limit: 100, starting_after: startingAfter })
    for (const s of page.data) {
      sessions.push({
        id: s.id,
        created: s.created,
        payment_status: s.payment_status,
        metadata: s.metadata,
        customer_email: s.customer_details?.email,
      })
    }
    startingAfter = page.has_more ? page.data[page.data.length - 1].id : undefined
  } while (startingAfter)

  const bezahlt = sessions.filter(s => s.payment_status === 'paid' && s.metadata?.reservierung_id)

  const probleme = []
  for (const s of bezahlt) {
    const reservierungId = s.metadata!.reservierung_id
    const { data: res } = await supabaseAdmin
      .from('reservierungen')
      .select('id, status, stripe_payment_intent_id, datum, erstellt_am, kunden(vorname, nachname, telefon)')
      .eq('id', reservierungId)
      .maybeSingle()

    if (!res) {
      probleme.push({ problem: 'RESERVIERUNG_FEHLT_KOMPLETT', session_id: s.id, reservierung_id: reservierungId, bezahlt_am: new Date(s.created * 1000).toISOString(), email: s.customer_email })
    } else if (res.status !== 'BESTAETIGT_BEZAHLT') {
      probleme.push({ problem: 'STATUS_NICHT_BEZAHLT', session_id: s.id, reservierung_id: reservierungId, aktueller_status: res.status, datum: res.datum, kunden: res.kunden, bezahlt_am: new Date(s.created * 1000).toISOString() })
    }
  }

  return NextResponse.json({
    sessions_gesamt: sessions.length,
    bezahlt_gesamt: bezahlt.length,
    probleme_gefunden: probleme.length,
    probleme,
  })
}
