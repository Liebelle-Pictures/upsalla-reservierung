import { NextRequest, NextResponse } from 'next/server'

export function pruefeLenaAuth(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.LENA_API_KEY) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }
  return null
}
