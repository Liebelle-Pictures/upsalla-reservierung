import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { logeIstVerfuegbarFuerSlot, zeitslotZeitraum, istGeschlossen } from '@/lib/utils/zeitslots'
import { istGueltigeTelefonnummer } from '@/lib/utils/telefon'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { erstelleAnzahlungsSession } from '@/lib/stripe/client'

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

  const { datum, loge_id: loge_id_raw, loge_name, zeitslot, typ, kinder_anzahl, erwachsene_anzahl, vorname, nachname, telefon, email, notizen } = body as {
    datum: string
    loge_id?: string
    loge_name?: string
    zeitslot: number
    typ: string
    kinder_anzahl: number
    erwachsene_anzahl?: number
    vorname: string
    nachname: string
    telefon: string
    email?: string
    notizen?: string
  }
  const erwachsene = Number(erwachsene_anzahl ?? 0)

  if (!datum || !zeitslot || !typ || !kinder_anzahl || !vorname || !nachname || !telefon) {
    return NextResponse.json({ hinweis: `Noch fehlende Angaben: ${[!datum && 'datum', !zeitslot && 'zeitslot', !typ && 'typ', !kinder_anzahl && 'kinder_anzahl', !vorname && 'vorname', !nachname && 'nachname', !telefon && 'telefon'].filter(Boolean).join(', ')}. Bitte beim Kunden erfragen.` })
  }

  if (!istGueltigeTelefonnummer(telefon)) {
    return NextResponse.json({ hinweis: 'Die übergebene Telefonnummer ist ungültig (keine erkennbare Ziffernfolge). Bitte den Kunden nochmal explizit nach der Telefonnummer fragen, Ziffer für Ziffer bestätigen lassen, und dann erneut versuchen.' })
  }

  const datumKorrigiert = normalisiertDatum(datum)
  if (!datumKorrigiert) {
    return NextResponse.json({ hinweis: 'Datum konnte nicht verarbeitet werden. Bitte nochmal mit dem Kunden bestätigen.' })
  }
  if (istGeschlossen(new Date(datumKorrigiert + 'T00:00:00'))) {
    return NextResponse.json({ hinweis: 'Der Park ist an diesem Tag geschlossen. Bitte ein anderes Datum vorschlagen.' })
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

  // Duplikat-Schutz: gleiche Loge/Datum von Lena in den letzten 15 Minuten angelegt?
  // Verhindert, dass wiederholte create_reservation-Aufrufe (z.B. weil Lena unsicher war, ob
  // der erste Versuch geklappt hat, oder weil sie eine falsch verstandene Angabe wie Kinderzahl
  // oder Loge korrigiert statt die vorherige Reservierung zu ändern) mehrere separate
  // Reservierungen + Stripe-Links + SMS erzeugen. Bewusst OHNE kinder_anzahl im Abgleich —
  // gerade eine Korrektur der Kinderzahl zwischen zwei Versuchen ist der häufigste Fall.
  const fuenfzehnMinutenVorher = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: kuerzlichErstellt } = await supabaseAdmin
    .from('reservierungen')
    .select('id')
    .eq('loge_id', loge_id)
    .eq('datum', datumKorrigiert)
    .is('erstellt_von', null)
    .neq('status', 'STORNIERT')
    .gte('erstellt_am', fuenfzehnMinutenVorher)
    .order('erstellt_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (kuerzlichErstellt) {
    return NextResponse.json({ hinweis: `Es wurde vor Kurzem bereits eine sehr ähnliche Reservierung für dieses Datum und diese Loge angelegt (ID: ${kuerzlichErstellt.id}). NICHT erneut mit create_reservation anlegen. Falls ein Detail wie Name oder Telefonnummer korrigiert werden muss, nutze change_reservation mit dieser ID. Falls es sich um eine andere, neue Familie handelt, das dem Kunden mitteilen und das Team informieren lassen.` })
  }

  // Loge-Info laden: Verfügbarkeitsregel + reale Kapazität
  const { data: logeInfo } = await supabaseAdmin
    .from('logen')
    .select('verfuegbarkeit_regel, max_kinder, kapazitaet_flexibel')
    .eq('id', loge_id)
    .single()

  if (!logeIstVerfuegbarFuerSlot(logeInfo?.verfuegbarkeit_regel ?? null, new Date(datumKorrigiert + 'T00:00:00'), zeitslot)) {
    return NextResponse.json({ hinweis: 'Diese Loge ist an diesem Tag/Zeitslot nicht verfügbar. Bitte einen anderen Termin oder eine andere Loge wählen.' })
  }

  // Doppelbelegung/Kapazität prüfen — gilt nicht für Gruppen (Kita/Schule) oder interne Sperrungen
  const logeKapazitaetRelevant = typ !== 'GRUPPE' && typ !== 'INTERN'

  if (logeKapazitaetRelevant) {
    const { data: aktiveBelegungen } = await supabaseAdmin
      .from('reservierungen')
      .select('kinder_anzahl')
      .eq('loge_id', loge_id)
      .eq('datum', datumKorrigiert)
      .eq('zeitslot', zeitslot)
      .neq('status', 'STORNIERT')

    const belegungen = aktiveBelegungen ?? []
    const bereitsKinder = belegungen.reduce((s, r) => s + r.kinder_anzahl, 0)

    if (logeInfo?.kapazitaet_flexibel) {
      // z.B. BBQ Zelt: keine feste Obergrenze, aber nur eine Gruppe gleichzeitig
      if (belegungen.length >= 1) {
        return NextResponse.json({ hinweis: 'Dieser Slot ist bereits belegt. Bitte einen anderen Termin oder eine andere Loge wählen.' })
      }
    } else {
      const maxKinder = logeInfo?.max_kinder ?? 16
      if (belegungen.length >= 2) {
        return NextResponse.json({ hinweis: 'Dieser Slot ist bereits mit zwei Gruppen belegt. Bitte einen anderen Termin oder eine andere Loge wählen.' })
      }
      if (belegungen.length === 1) {
        const ersteGruppe = belegungen[0]
        if (ersteGruppe.kinder_anzahl >= 10) {
          return NextResponse.json({ hinweis: 'Diese Loge ist für diesen Slot exklusiv belegt (10+ Kinder). Bitte einen anderen Termin oder eine andere Loge wählen.' })
        }
        if (kinder_anzahl >= 10) {
          return NextResponse.json({ hinweis: `In dieser Loge/diesem Slot gibt es bereits eine Gruppe mit ${ersteGruppe.kinder_anzahl} Kindern. Eine exklusive Buchung (10+ Kinder) ist nicht mehr möglich.` })
        }
        if (bereitsKinder + kinder_anzahl > maxKinder) {
          return NextResponse.json({ hinweis: `In dieser Loge sind bereits ${bereitsKinder} Kinder gebucht. Maximal ${maxKinder - bereitsKinder} weitere Kinder möglich.` })
        }
      }
      if (belegungen.length === 0 && kinder_anzahl > maxKinder) {
        return NextResponse.json({ hinweis: `Diese Loge fasst maximal ${maxKinder} Kinder. Bitte eine andere Loge vorschlagen oder die Gruppe aufteilen.` })
      }
    }
  }

  const weekend = await istPreisteuerterTag(new Date(datumKorrigiert + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinder_anzahl, weekend, erwachsene)
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
    erwachsene_anzahl: erwachsene,
    paket_preis_pro_kind: paketPreisProKind,
    gesamtbetrag,
    anzahlung_betrag: anzahlungBetrag,
    notizen: notizen ?? null,
    angenommen_von: 'KI LENA',
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

  // Stripe Checkout Session erstellen
  const datumAnzeige = new Date(datumKorrigiert + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const { start: lenaSlotStart, ende: lenaSlotEnde } = zeitslotZeitraum(zeitslot, weekend)
  const zeitAnzeige = `${lenaSlotStart}–${lenaSlotEnde}`

  let zahlungsLink: string | null = null
  try {
    zahlungsLink = await erstelleAnzahlungsSession({
      betragCent: Math.round(anzahlungBetrag * 100),
      reservierungId,
      beschreibung: `Anzahlung Geburtstag Upsalla – ${datumAnzeige} (${zeitAnzeige})`,
      kundenEmail: email as string | undefined,
    })
    await supabaseAdmin
      .from('reservierungen')
      .update({ stripe_payment_link: zahlungsLink })
      .eq('id', reservierungId)
  } catch (e) {
    console.error('[Stripe] Fehler beim Erstellen der Session:', e)
  }

  // SMS mit Zahlungslink senden
  const smsText = zahlungsLink
    ? `Hallo ${vorname}! Euer Geburtstag im Upsalla Kinderpark am ${datumAnzeige} (${zeitAnzeige}) fuer ${kinder_anzahl} Kinder ist vorgemerkt. Anzahlung: ${anzahlungBetrag.toFixed(2)} Euro. Bitte hier bezahlen um den Termin zu sichern: ${zahlungsLink}`
    : `Hallo ${vorname}! Euer Geburtstag im Upsalla Kinderpark am ${datumAnzeige} (${zeitAnzeige}) fuer ${kinder_anzahl} Kinder ist vorgemerkt. Anzahlung: ${anzahlungBetrag.toFixed(2)} Euro. Wir melden uns in Kuerze mit dem Zahlungslink.`

  await sendeSMS(telefon, smsText)

  return NextResponse.json({
    erfolg: true,
    reservierung_id: reservierungId,
    datum: datumKorrigiert,
    gesamtbetrag,
    anzahlung: anzahlungBetrag,
    zahlungslink: zahlungsLink ?? 'wird nachgesendet',
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

  const reservierungenFormatiert = await Promise.all((reservierungen ?? []).map(async (r: Record<string, unknown>) => {
    const weekend = await istPreisteuerterTag(new Date((r.datum as string) + 'T00:00:00'))
    const { start, ende } = zeitslotZeitraum(r.zeitslot as number, weekend)
    return {
      id: r.id,
      datum: r.datum,
      zeitslot: `${start}–${ende} Uhr`,
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
