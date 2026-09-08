import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET /p/[code] — Kurzlink-Weiterleitung für Stripe-Zahlungslinks aus SMS
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params

  const { data } = await supabaseAdmin
    .from('sms_kurzlinks')
    .select('ziel_url, laeuft_ab_am')
    .eq('code', code)
    .maybeSingle()

  if (!data || new Date(data.laeuft_ab_am) < new Date()) {
    return NextResponse.redirect(new URL('/', request.url), 303)
  }

  return NextResponse.redirect(data.ziel_url, 303)
}
