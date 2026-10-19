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
