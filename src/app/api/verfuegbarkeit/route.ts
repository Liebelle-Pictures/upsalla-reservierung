import { NextRequest, NextResponse } from 'next/server'

// GET /api/verfuegbarkeit?datum=YYYY-MM-DD&standort=wuppertal
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const datum = searchParams.get('datum')
  const standort = searchParams.get('standort')

  if (!datum || !standort) {
    return NextResponse.json(
      { fehler: 'Parameter datum und standort erforderlich' },
      { status: 400 },
    )
  }

  // TODO: Supabase-Abfrage implementieren
  return NextResponse.json({ datum, standort, logen: [] })
}
