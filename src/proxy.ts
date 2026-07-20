import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|manifest|icon|apple-icon|.*\\.(?:ico|png|jpg|jpeg|svg|webmanifest|json|css|js|woff2?|ttf|otf)$|api/webhooks|api/lena|api/cron|zahlung|agb).*)',
  ],
}
