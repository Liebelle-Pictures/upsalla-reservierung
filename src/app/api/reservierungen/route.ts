import { NextRequest, NextResponse } from 'next/server'

// GET /api/reservierungen
export async function GET() {
  // TODO: Supabase-Abfrage, RLS filtert nach Rolle
  return NextResponse.json({ reservierungen: [] })
}

// POST /api/reservierungen
export async function POST(request: NextRequest) {
  const body = await request.json()

  // TODO: Validierung + Supabase Insert + Stripe Link + SMS + E-Mail
  void body

  return NextResponse.json({ id: 'TODO' }, { status: 201 })
}
