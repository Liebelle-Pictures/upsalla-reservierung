import { stripe } from '@/lib/stripe/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

export default async function ZahlungErfolgPage({ searchParams }: Props) {
  const { session_id } = await searchParams

  if (!session_id) {
    return <Fehler text="Ungültiger Zahlungslink." />
  }

  let status: 'erfolg' | 'ausstehend' | 'fehler' = 'fehler'
  let datumAnzeige = ''
  let vorname = ''

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)
    const reservierungId = session.metadata?.reservierung_id

    if (session.payment_status === 'paid' && reservierungId) {
      const { data: res } = await supabaseAdmin
        .from('reservierungen')
        .select('datum, zeitslot, status, kunden(vorname)')
        .eq('id', reservierungId)
        .single()

      if (res) {
        const kundeRaw = res.kunden
        const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string } | null
        vorname = kunde?.vorname ?? ''

        datumAnzeige = new Date(res.datum + 'T00:00:00').toLocaleDateString('de-DE', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        })

        if (res.status !== 'BESTAETIGT_BEZAHLT') {
          await supabaseAdmin
            .from('reservierungen')
            .update({
              status: 'BESTAETIGT_BEZAHLT',
              stripe_payment_intent_id: session.payment_intent as string,
              aktualisiert_am: new Date().toISOString(),
            })
            .eq('id', reservierungId)
        }

        status = 'erfolg'
      }
    } else if (session.payment_status === 'unpaid') {
      status = 'ausstehend'
    }
  } catch (e) {
    console.error('[Zahlung] Fehler:', e)
    status = 'fehler'
  }

  if (status === 'erfolg') {
    return (
      <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '40px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#15803d', marginBottom: '8px' }}>
            Anzahlung erhalten!
          </h1>
          {vorname && (
            <p style={{ fontSize: '18px', color: '#374151', marginBottom: '8px' }}>
              Danke, {vorname}!
            </p>
          )}
          {datumAnzeige && (
            <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '24px' }}>
              Euer Geburtstag am <strong>{datumAnzeige}</strong> ist jetzt fest gebucht.
            </p>
          )}
          <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <p style={{ fontSize: '14px', color: '#15803d', margin: 0 }}>
              Ihr bekommt in Kürze eine Bestätigungs-SMS. Bei Fragen: <strong>0202 2623339</strong>
            </p>
          </div>
          <p style={{ fontSize: '14px', color: '#9ca3af' }}>
            Wir freuen uns auf euren Besuch im Upsalla Kinderpark! 🎈
          </p>
        </div>
      </div>
    )
  }

  if (status === 'ausstehend') {
    return <Fehler text="Die Zahlung ist noch nicht abgeschlossen. Bitte versucht es erneut." />
  }

  return <Fehler text="Leider konnte die Zahlung nicht bestätigt werden. Bitte kontaktiert uns: 0202 2623339" />
}

function Fehler({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <p style={{ fontSize: '16px', color: '#374151' }}>{text}</p>
      </div>
    </div>
  )
}
