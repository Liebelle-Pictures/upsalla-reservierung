import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Deutsche Mobilnummer erkennen: +4915x, +4916x, +4917x
function istDeutschesMobil(nummer: string): boolean {
  return /^\+49(15|16|17)\d/.test(nummer)
}

// Nummer für Lena lesbar formatieren: +491521234567 → +49 152 1234567
function formatiereNummer(nummer: string): string {
  if (nummer.startsWith('+49')) {
    const rest = nummer.slice(3)
    return `+49 ${rest.slice(0, 3)} ${rest.slice(3)}`
  }
  return nummer
}

// POST /api/webhooks/retell-variablen
// Retell ruft diesen Endpoint am Anfang jedes Anrufs auf und erhält dynamische Variablen
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
