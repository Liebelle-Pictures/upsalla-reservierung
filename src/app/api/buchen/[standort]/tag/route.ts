// GET /api/buchen/[standort]/tag?datum=YYYY-MM-DD — freie Slots und Logen eines Tages für die
// Online-Buchung. Gibt nur Verfügbarkeit zurück, nichts über andere Kunden oder Buchungen.
// Regeln wie reserviere_online (siehe src/lib/verfuegbarkeit.ts).
import { NextRequest, NextResponse } from 'next/server'
import { ladeOnlineStandort } from '@/lib/online-buchung/standort'
import { istGueltigesDatum, istImBuchungsfenster } from '@/lib/online-buchung/validierung'
import { berechneVerfuegbarkeit } from '@/lib/verfuegbarkeit'
import { getVerfuegbareSlots, zeitslotZeitraum } from '@/lib/utils/zeitslots'
import { KIND_PREIS_WOCHENENDE, KIND_PREIS_WOCHENTAG, ERWACHSENE_PREIS_WOCHENENDE, ERWACHSENE_PREIS_WOCHENTAG } from '@/lib/utils/preise'

export const dynamic = 'force-dynamic'

const KEIN_CACHE = { 'Cache-Control': 'no-store' }

interface LogeAntwort {
  loge_id: string
  name: string
  ist_babywelt: boolean
  // Höchstzahl Kinder, die ihr in dieser Loge/diesem Slot buchen könnt
  max_kinder: number
}

interface SlotAntwort {
  zeitslot: number
  start: string
  ende: string
  logen: LogeAntwort[]
}

export async function GET(request: NextRequest, ctx: RouteContext<'/api/buchen/[standort]/tag'>) {
  const { standort: slug } = await ctx.params
  const standort = await ladeOnlineStandort(slug)
  if (!standort) return NextResponse.json({ fehler: 'Nicht gefunden' }, { status: 404, headers: KEIN_CACHE })

  const datum = request.nextUrl.searchParams.get('datum')
  if (!istGueltigesDatum(datum)) {
    return NextResponse.json({ fehler: 'Parameter datum fehlt oder ist ungültig (YYYY-MM-DD).' }, { status: 400, headers: KEIN_CACHE })
  }

  if (!istImBuchungsfenster(datum)) {
    return NextResponse.json({ datum, buchbar: false, grund: 'nicht_buchbar', slots: [] }, { headers: KEIN_CACHE })
  }

  const ergebnis = await berechneVerfuegbarkeit({ standortId: standort.id, datum, modus: 'ONLINE' })
  if (ergebnis.geschlossen) {
    return NextResponse.json({ datum, buchbar: false, grund: 'geschlossen', slots: [] }, { headers: KEIN_CACHE })
  }

  const teuer = ergebnis.teuerterTag
  const slots: SlotAntwort[] = getVerfuegbareSlots(new Date(datum + 'T00:00:00'), teuer).map(s => ({
    zeitslot: s.nummer,
    ...zeitslotZeitraum(s.nummer, teuer),
    logen: ergebnis.verfuegbar
      .filter(v => v.zeitslot === s.nummer && v.max_kinder !== null)
      .map(v => ({ loge_id: v.loge_id, name: v.loge_name, ist_babywelt: v.ist_babywelt, max_kinder: v.max_kinder as number })),
  }))

  return NextResponse.json({
    datum,
    buchbar: slots.some(s => s.logen.length > 0),
    wochenendpreis: teuer,
    preis_pro_kind: teuer ? KIND_PREIS_WOCHENENDE : KIND_PREIS_WOCHENTAG,
    preis_pro_erwachsener: teuer ? ERWACHSENE_PREIS_WOCHENENDE : ERWACHSENE_PREIS_WOCHENTAG,
    slots,
  }, { headers: KEIN_CACHE })
}
