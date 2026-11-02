// GET /api/buchen/[standort]/monat?monat=YYYY-MM — öffentliche Monatsübersicht für den Kalender
// der Online-Buchung. Regeln wie reserviere_online (siehe src/lib/verfuegbarkeit.ts).
import { NextRequest, NextResponse } from 'next/server'
import { ladeOnlineStandort } from '@/lib/online-buchung/standort'
import { buchungsfenster, istGueltigerMonat } from '@/lib/online-buchung/validierung'
import { berechneMonatsuebersicht, type TagesStatus } from '@/lib/verfuegbarkeit'

export const dynamic = 'force-dynamic'

const KEIN_CACHE = { 'Cache-Control': 'no-store' }

interface MonatsTagAntwort {
  datum: string
  status: TagesStatus | 'nicht_buchbar'
  wochenendpreis: boolean
}

export async function GET(request: NextRequest, ctx: RouteContext<'/api/buchen/[standort]/monat'>) {
  const { standort: slug } = await ctx.params
  const standort = await ladeOnlineStandort(slug)
  if (!standort) return NextResponse.json({ fehler: 'Nicht gefunden' }, { status: 404, headers: KEIN_CACHE })

  const monat = request.nextUrl.searchParams.get('monat')
  if (!istGueltigerMonat(monat)) {
    return NextResponse.json({ fehler: 'Parameter monat fehlt oder ist ungültig (YYYY-MM).' }, { status: 400, headers: KEIN_CACHE })
  }

  const fenster = buchungsfenster()
  const tageImMonat = new Date(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)), 0).getDate()
  const monatsEnde = `${monat}-${String(tageImMonat).padStart(2, '0')}`

  let tage: MonatsTagAntwort[]
  if (monatsEnde < fenster.von || `${monat}-01` > fenster.bis) {
    // Monat liegt komplett außerhalb des Buchungsfensters → keine DB-Abfrage nötig
    tage = Array.from({ length: tageImMonat }, (_, i) => ({
      datum: `${monat}-${String(i + 1).padStart(2, '0')}`,
      status: 'nicht_buchbar' as const,
      wochenendpreis: false,
    }))
  } else {
    tage = (await berechneMonatsuebersicht(standort.id, monat)).map(t => ({
      ...t,
      status: t.datum < fenster.von || t.datum > fenster.bis ? 'nicht_buchbar' : t.status,
    }))
  }

  return NextResponse.json({ monat, buchbar_von: fenster.von, buchbar_bis: fenster.bis, tage }, { headers: KEIN_CACHE })
}
