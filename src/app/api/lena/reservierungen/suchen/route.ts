import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { zeitslotZeitraum } from '@/lib/utils/zeitslots'

export const dynamic = 'force-dynamic'

function normalisiereTelefon(t: string): string {
  return t.replace(/[\s()-]/g, '')
}

// POST /api/lena/reservierungen/suchen — Reservierungen nach Telefon (mit Formatierungs-
// Toleranz) oder ersatzweise nach Name suchen
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const body = await request.json().catch(() => ({}))
  // Retell sendet Argumente in body.args
  const args = body.args ?? body
  console.log('[find_reservation] args:', JSON.stringify(args))

  const telefon = args.telefon ?? args.Telefon ?? args.phone ?? request.nextUrl.searchParams.get('telefon')
  const name = args.name as string | undefined

  if (!telefon && !name) {
    console.log('[find_reservation] weder telefon noch name, body keys:', Object.keys(body))
    return NextResponse.json({ hinweis: 'Bitte zuerst die Telefonnummer des Kunden erfragen, dann erneut aufrufen.' })
  }

  let kunde: { id: string; vorname: string; nachname: string } | null = null

  if (telefon) {
    // 1. Versuch: exakte Übereinstimmung
    const exakt = await supabaseAdmin
      .from('kunden')
      .select('id, vorname, nachname')
      .eq('telefon', telefon)
      .maybeSingle()
    kunde = exakt.data

    // 2. Versuch: Formatierungs-tolerant über die letzten 8 Ziffern (Leerzeichen/Bindestriche
    // sind eine bekannt häufige Ursache für "nicht gefunden", obwohl die Nummer stimmt)
    if (!kunde) {
      const normalisiert = normalisiereTelefon(telefon)
      const letzte8 = normalisiert.slice(-8)
      if (letzte8.length === 8) {
        const { data: kandidaten } = await supabaseAdmin
          .from('kunden')
          .select('id, vorname, nachname, telefon')
          .ilike('telefon', `%${letzte8}`)
        kunde = (kandidaten ?? []).find(k => normalisiereTelefon(k.telefon) === normalisiert) ?? null
      }
    }
  }

  // 3. Versuch: Name als Ersatzsuche, falls Telefonsuche nichts findet (z.B. Buchung lief auf
  // anderer Nummer). Nur bei eindeutigem Treffer automatisch übernehmen.
  if (!kunde && name) {
    const { data: kandidaten } = await supabaseAdmin
      .from('kunden')
      .select('id, vorname, nachname')
      .or(`vorname.ilike.%${name}%,nachname.ilike.%${name}%`)
      .limit(5)

    if (kandidaten && kandidaten.length === 1) {
      kunde = kandidaten[0]
    } else if (kandidaten && kandidaten.length > 1) {
      return NextResponse.json({
        hinweis: `Mehrere Kunden mit ähnlichem Namen gefunden (${kandidaten.map(k => `${k.vorname} ${k.nachname}`).join(', ')}). Bitte Telefonnummer erneut erfragen und Ziffer für Ziffer bestätigen, um eindeutig zu suchen.`,
      })
    }
  }

  if (!kunde) {
    return NextResponse.json({ reservierungen: [] })
  }

  const heute = new Date()
  const jahr = heute.getFullYear()
  const monat = String(heute.getMonth() + 1).padStart(2, '0')
  const tag = String(heute.getDate()).padStart(2, '0')
  const heuteDatum = `${jahr}-${monat}-${tag}`

  const { data: reservierungen } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, status, typ, kinder_anzahl, logen(name)')
    .eq('kunde_id', kunde.id)
    .neq('status', 'STORNIERT')
    .gte('datum', heuteDatum)
    .order('datum', { ascending: true })

  const reservierungenFormatiert = await Promise.all((reservierungen ?? []).map(async (r: Record<string, unknown>) => {
    const weekend = await istPreisteuerterTag(new Date((r.datum as string) + 'T00:00:00'))
    const { start, ende } = zeitslotZeitraum(r.zeitslot as number, weekend)
    return {
      id: r.id,
      datum: r.datum,
      zeitslot: `${start}-${ende} Uhr`,
      status: r.status,
      typ: r.typ,
      kinder_anzahl: r.kinder_anzahl,
      loge: (r.logen as { name: string } | null)?.name,
    }
  }))

  return NextResponse.json({
    kunde: { vorname: kunde.vorname, nachname: kunde.nachname },
    reservierungen: reservierungenFormatiert,
  })
}
