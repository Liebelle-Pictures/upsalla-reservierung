import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/reservierungen/:id
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  // TODO: Supabase-Abfrage
  return NextResponse.json({ id })
}

// PATCH /api/reservierungen/:id
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json()
  // TODO: Update in Supabase
  void body
  return NextResponse.json({ id })
}
