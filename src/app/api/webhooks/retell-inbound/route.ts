import { NextRequest, NextResponse } from 'next/server'
import { Retell } from 'retell-sdk'

export const dynamic = 'force-dynamic'

// POST /api/webhooks/retell-inbound — Retells "Inbound Call Webhook" (pro Telefonnummer
// konfiguriert, NICHT der allgemeine Event-Webhook für call_started/call_ended/call_analyzed).
// Muss innerhalb weniger Sekunden antworten, bevor der Agent zu sprechen beginnt — deshalb
// keine DB-Zugriffe hier, nur reine Stringverarbeitung.
//
// Vorherige Implementierung (call_started im allgemeinen Webhook, llm_dynamic_variables direkt
// zurückgeben) war der falsche Mechanismus — dieser wird laut Retell nur für Monitoring/
// Analytics zuverlässig ausgewertet, nicht für die Variablenübergabe vor dem ersten Wort des
// Agents. Der korrekte Weg ist dieser dedizierte, pro Rufnummer konfigurierte Webhook mit der
// Antwortform { call_inbound: { dynamic_variables: {...} } }.
export async function POST(request: NextRequest) {
  const payload = await request.text()

  const secret = process.env.RETELL_WEBHOOK_SECRET
  if (secret) {
    const signatur = request.headers.get('x-retell-signature')
    if (!signatur || !(await Retell.verify(payload, secret, signatur))) {
      return NextResponse.json({ fehler: 'Ungültige Signatur' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(payload)
  } catch {
    return NextResponse.json({ call_inbound: { dynamic_variables: { caller_phone: 'unbekannt', ist_mobil: 'nein' } } })
  }

  // Bei Anrufen, die über die FRITZ!Box unconditional an Twilio weitergeleitet werden,
  // ist "from_number" zum Zeitpunkt dieses Webhooks (vor Abschluss des SIP-Setups) leer/
  // unzuverlässig — die echte Anrufer-Nummer steht stattdessen zuverlässig im
  // "P-Asserted-Identity"-SIP-Header (Format: '"+49..." <sip:+49...@...>'). Das war die
  // Ursache dafür, dass caller_phone in praktisch allen echten Anrufen "unbekannt" blieb,
  // obwohl from_number im fertigen Call-Objekt danach korrekt gesetzt war.
  const sipHeaders = (body.custom_sip_headers as Record<string, string> | undefined) ?? {}
  const paiKey = Object.keys(sipHeaders).find(k => k.toLowerCase() === 'p-asserted-identity')
  const paiValue = paiKey ? sipHeaders[paiKey] : undefined
  const paiMatch = paiValue?.match(/\+\d{6,15}/)

  const fromNumber = paiMatch?.[0] ?? (body.from_number as string | undefined) ?? null

  if (!fromNumber) {
    return NextResponse.json({ call_inbound: { dynamic_variables: { caller_phone: 'unbekannt', ist_mobil: 'nein' } } })
  }

  const istMobil = /^\+49(15|16|17)\d/.test(fromNumber)
  // Lokales Format (0...) statt international (+49...) — Kunden nennen/bestätigen Nummern
  // lokal, das +49-Format sorgt nur für Verwirrung.
  const callerPhone = fromNumber.startsWith('+49') ? `0${fromNumber.slice(3)}` : fromNumber

  return NextResponse.json({
    call_inbound: {
      dynamic_variables: {
        caller_phone: callerPhone,
        ist_mobil: istMobil ? 'ja' : 'nein',
      },
    },
  })
}
