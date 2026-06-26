import { NextRequest, NextResponse } from 'next/server'

// GET /api/standorte/verfuegbarkeit?datum=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const datum = searchParams.get('datum')

  if (!datum) {
    return NextResponse.json(
      { fehler: 'Parameter datum erforderlich' },
      { status: 400 },
    )
  }

  // TODO: Alle 3 Standorte abfragen (Wuppertal, Solingen, Velbert)
  return NextResponse.json({ datum, standorte: [] })
}
