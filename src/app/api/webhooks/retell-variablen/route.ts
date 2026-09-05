import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Deutsche Mobilnummer erkennen: +4915x, +4916x, +4917x
function istDeutschesMobil(nummer: string): boolean {
  return /^\+49(15|16|17)\d/.test(nummer)
}

// Nummer ins lokale Format bringen, das Kunden tatsächlich verwenden: +491521234567 → 01521234567
// (NICHT im internationalen +49-Format zurückgeben — das verwirrt Anrufer und führt zu
// Übertragungsfehlern, wenn Lena die Nummer laut vorliest/bestätigt.)
function formatiereNummer(nummer: string): string {
  if (nummer.startsWith('+49')) {
    return `0${nummer.slice(3)}`
  }
  return nummer
}

// POST /api/webhooks/retell-variablen
// Retell ruft diesen Endpoint am Anfang jedes Anrufs auf und erhält dynamische Variablen
//
// ACHTUNG: from_number ist NICHT die Nummer des anrufenden Kunden. Der Park nutzt eine
// Rufumleitung von der Festnetznummer (+492022623339) auf die Twilio-Nummer — einfache
// PSTN-Umleitung reicht die ursprüngliche Anrufer-ID nicht durch. from_number ist daher
// praktisch immer die Umleitungsnummer, nie die des Kunden. caller_phone/ist_mobil werden
// deshalb im Prompt NICHT verwendet (Lena fragt aktiv nach der Nummer). Diese Variablen nur
// wieder im Prompt verwenden, wenn die Anrufweiterleitung technisch auf echtes SIP-Trunking
// mit Diversion-Header-Durchreichung umgestellt wird.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ caller_phone: 'unbekannt', ist_mobil: 'nein' })
  }

  // Retell sendet from_number entweder direkt oder in einem call-Objekt
  const fromNumber =
    (body.from_number as string | undefined) ??
    ((body.call as Record<string, unknown> | undefined)?.from_number as string | undefined) ??
    null

  console.log('[Retell Variablen] from_number:', fromNumber, '| body keys:', Object.keys(body))

  if (!fromNumber) {
    return NextResponse.json({
      caller_phone: 'unbekannt',
      ist_mobil: 'nein',
    })
  }

  const mobil = istDeutschesMobil(fromNumber)

  return NextResponse.json({
    caller_phone: formatiereNummer(fromNumber),
    ist_mobil: mobil ? 'ja' : 'nein',
  })
}
