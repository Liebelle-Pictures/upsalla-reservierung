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

  const fromNumber = (body.from_number as string | undefined) ?? null

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
