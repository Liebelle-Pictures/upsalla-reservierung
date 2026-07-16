import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istWochenende } from '@/lib/utils/zeitslots'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'

export const dynamic = 'force-dynamic'

function normalisiertDatum(raw: string): string | null {
  if (!raw) return null
  let result: string | null = null
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) result = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  if (!result) {
    const deMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (deMatch) result = `${deMatch[3]}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`
  }
  if (!result) {
    const monate: Record<string, string> = { januar:'01',februar:'02',märz:'03',april:'04',mai:'05',juni:'06',juli:'07',august:'08',september:'09',oktober:'10',november:'11',dezember:'12' }
    const nameMatch = raw.toLowerCase().match(/(\d{1,2})\.?\s+(\w+)\s+(\d{4})/)
    if (nameMatch && monate[nameMatch[2]]) result = `${nameMatch[3]}-${monate[nameMatch[2]]}-${nameMatch[1].padStart(2, '0')}`
  }
  if (!result) return null
  const jahr = parseInt(result.slice(0, 4))
  if (jahr < 2026) result = '2026' + result.slice(4)
  return result
}

// POST /api/lena/reservierungen — Reservierung durch Lena erstellen
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  let body: Record<string, unknown>
  try {
    const raw = await request.json()
    // Retell sendet Argumente in body.args
    body = (raw.args ?? raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ fehler: 'Ungültiges JSON' }, { status: 400 })
  }

  const { datum, loge_id: loge_id_raw, loge_name, zeitslot, typ, kinder_anzahl, vorname, nachname, telefon, email, notizen } = body as {
    datum: string
    loge_id?: string
    loge_name?: string
    zeitslot: number
    typ: string
    kinder_anzahl: number
    vorname: string
    nachname: string
    telefon: string
    email?: string
    notizen?: string
  }

  if (!datum || !zeitslot || !typ || !kinder_anzahl || !vorname || !nachname || !telefon) {
    return NextResponse.json({ hinweis: `Noch fehlende Angaben: ${[!datum && 'datum', !zeitslot && 'zeitslot', !typ && 'typ', !kinder_anzahl && 'kinder_anzahl', !vorname && 'vorname', !nachname && 'nachname', !telefon && 'telefon'].filter(Boolean).join(', ')}. Bitte beim Kunden erfragen.` })
  }

  const datumKorrigiert = normalisiertDatum(datum)
  if (!datumKorrigiert) {
    return NextResponse.json({ hinweis: 'Datum konnte nicht verarbeitet werden. Bitte nochmal mit dem Kunden bestätigen.' })
  }

  // loge_id aus loge_name auflösen falls nötig
  let loge_id = loge_id_raw
  if (!loge_id && loge_name) {
    const { data: loge } = await supabaseAdmin
      .from('logen')
      .select('id')
      .eq('standort_id', WUPPERTAL_STANDORT_ID)
      .ilike('name', `%${loge_name}%`)
      .maybeSingle()
    if (!loge) {
      return NextResponse.json({ hinweis: `Loge "${loge_name}" nicht gefunden. Bitte eine der verfügbaren Logen auswählen.` })
    }
    loge_id = loge.id
  }

  if (!loge_id) {
    return NextResponse.json({ hinweis: 'Loge nicht angegeben. Bitte Loge vom Kunden erfragen.' })
  }

  const weekend = istWochenende(new Date(datumKorrigiert + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinder_anzahl, weekend)
  const anzahlungBetrag = berechneAnzahlung(gesamtbetrag)
  const paketPreisProKind = weekend ? 27.0 : 23.0

  // Kunde suchen oder anlegen
  const { data: vorhandenerKunde } = await supabaseAdmin
    .from('kunden')
    .select('id')
    .eq('telefon', telefon)
    .maybeSingle()

  let kundeId: string

  if (vorhandenerKunde) {
    await supabaseAdmin.from('kunden').update({ vorname, nachname, email: email ?? null }).eq('id', vorhandenerKunde.id)
    kundeId = vorhandenerKunde.id
  } else {
    const { data: neuerKunde, error } = await supabaseAdmin
      .from('kunden')
      .insert({ standort_id: WUPPERTAL_STANDORT_ID, vorname, nachname, telefon, email: email ?? null, dsgvo_einwilligung: true, newsletter_opt_in: false })
      .select('id')
      .single()
    if (error || !neuerKunde) {
      return NextResponse.json({ fehler: 'Kunde konnte nicht gespeichert werden' }, { status: 500 })
    }
    kundeId = neuerKunde.id
  }

  // Stornierte Reservierung wiederverwenden oder neu anlegen
  const { data: storniert } = await supabaseAdmin
    .from('reservierungen')
    .select('id')
    .eq('loge_id', loge_id)
    .eq('datum', datumKorrigiert)
    .eq('zeitslot', zeitslot)
    .eq('status', 'STORNIERT')
    .maybeSingle()

  const reservierungsDaten = {
    standort_id: WUPPERTAL_STANDORT_ID,
    loge_id,
    kunde_id: kundeId,
    typ,
    status: 'BESTAETIGT_AUSSTEHEND',
    datum: datumKorrigiert,
    zeitslot,
    kinder_anzahl,
    erwachsene_anzahl: 0,
    paket_preis_pro_kind: paketPreisProKind,
    gesamtbetrag,
    anzahlung_betrag: anzahlungBetrag,
    notizen: notizen ?? null,
    stripe_payment_link: null,
    stripe_payment_intent_id: null,
    aktualisiert_am: new Date().toISOString(),
  }

  let reservierungId: string

  if (storniert) {
    await supabaseAdmin.from('reservierungen').update(reservierungsDaten).eq('id', storniert.id)
    reservierungId = storniert.id
  } else {
    const { data: neu, error } = await supabaseAdmin
      .from('reservierungen')
      .insert(reservierungsDaten)
      .select('id')
      .single()
    if (error || !neu) {
      if (error?.code === '23505') {
        return NextResponse.json({ fehler: 'Dieser Slot ist bereits belegt' }, { status: 409 })
      }
      return NextResponse.json({ fehler: 'Reservierung konnte nicht gespeichert werden' }, { status: 500 })
    }
    reservierungId = neu.id
  }

  // Bestätigungs-SMS senden
  const datumAnzeige = new Date(datumKorrigiert + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const zeitAnzeige = zeitslot === 1 ? '10:30–14:30' : '15:00–19:00'

  await sendeSMS(
    telefon,
    `Hallo ${vorname}, Ihre Reservierung bei Upsalla Kinderpark Wuppertal am ${datumAnzeige} (${zeitAnzeige} Uhr) für ${kinder_anzahl} Kinder ist bestätigt. Anzahlung: ${anzahlungBetrag.toFixed(2)} €. Wir freuen uns auf Sie! 🎉`,
  )

  return NextResponse.json({
    erfolg: true,
    reservierung_id: reservierungId,
    datum: datumKorrigiert,
    gesamtbetrag,
    anzahlung: anzahlungBetrag,
  })
}

// GET /api/lena/reservierungen?telefon=... — Reservierungen nach Telefonnummer suchen
export async function GET(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const telefon = request.nextUrl.searchParams.get('telefon')
  if (!telefon) {
    return NextResponse.json({ hinweis: 'Bitte zuerst die Telefonnummer des Kunden erfragen, dann erneut aufrufen.' })
  }

  const { data: kunde } = await supabaseAdmin
    .from('kunden')
    .select('id, vorname, nachname')
    .eq('telefon', telefon)
    .maybeSingle()

  if (!kunde) {
    return NextResponse.json({ reservierungen: [] })
  }

  const { data: reservierungen } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, status, typ, kinder_anzahl, logen(name)')
    .eq('kunde_id', kunde.id)
    .neq('status', 'STORNIERT')
    .gte('datum', new Date().toISOString().slice(0, 10))
    .order('datum', { ascending: true })

  return NextResponse.json({
    kunde: { vorname: kunde.vorname, nachname: kunde.nachname },
    reservierungen: (reservierungen ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      datum: r.datum,
      zeitslot: r.zeitslot === 1 ? '10:30–14:30 Uhr' : '15:00–19:00 Uhr',
      status: r.status,
      typ: r.typ,
      kinder_anzahl: r.kinder_anzahl,
      loge: (r.logen as { name: string } | null)?.name,
    })),
  })
}
