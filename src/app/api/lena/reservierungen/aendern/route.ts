import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { logeIstVerfuegbarFuerSlot, istGeschlossen } from '@/lib/utils/zeitslots'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'

export const dynamic = 'force-dynamic'

// POST /api/lena/reservierungen/aendern — Reservierung ändern
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const raw = await request.json().catch(() => ({}))
  const body = (raw.args ?? raw) as {
    id: string
    datum?: string
    zeitslot?: number
    loge_id?: string
    loge_name?: string
    kinder_anzahl?: number
    erwachsene_anzahl?: number
    notizen?: string
  }
  if (!body.id) return NextResponse.json({ hinweis: 'Reservierungs-ID fehlt. Bitte zuerst find_reservation aufrufen.' })

  const { data: reservierung } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, zeitslot, loge_id, typ, kinder_anzahl, erwachsene_anzahl, notizen, status')
    .eq('id', body.id)
    .single()

  if (!reservierung) return NextResponse.json({ fehler: 'Reservierung nicht gefunden' }, { status: 404 })
  if (reservierung.status === 'STORNIERT') return NextResponse.json({ fehler: 'Stornierte Reservierung kann nicht geaendert werden' }, { status: 400 })

  const neuesDatum = body.datum ?? reservierung.datum
  const neuerZeitslot = body.zeitslot ?? reservierung.zeitslot
  const kinderAnzahl = body.kinder_anzahl ?? reservierung.kinder_anzahl
  const erwachseneAnzahl = body.erwachsene_anzahl ?? reservierung.erwachsene_anzahl ?? 0

  if (istGeschlossen(new Date(neuesDatum + 'T00:00:00'))) {
    return NextResponse.json({ hinweis: 'Der Park ist an diesem Tag geschlossen. Bitte ein anderes Datum vorschlagen.' })
  }

  // loge_id aus loge_name auflösen falls nötig
  let neueLogeId = body.loge_id ?? reservierung.loge_id
  if (!body.loge_id && body.loge_name) {
    const { data: loge } = await supabaseAdmin
      .from('logen')
      .select('id')
      .eq('standort_id', WUPPERTAL_STANDORT_ID)
      .ilike('name', `%${body.loge_name}%`)
      .maybeSingle()
    if (!loge) {
      return NextResponse.json({ hinweis: `Loge "${body.loge_name}" nicht gefunden. Bitte eine der verfügbaren Logen auswählen.` })
    }
    neueLogeId = loge.id
  }

  // Verfügbarkeit/Kapazität nur neu prüfen, wenn sich Loge, Datum oder Zeitslot tatsächlich ändern
  const relevanteAenderung = neueLogeId !== reservierung.loge_id || neuesDatum !== reservierung.datum || neuerZeitslot !== reservierung.zeitslot

  if (relevanteAenderung) {
    const { data: logeInfo } = await supabaseAdmin
      .from('logen')
      .select('verfuegbarkeit_regel, max_kinder, kapazitaet_flexibel')
      .eq('id', neueLogeId)
      .single()

    if (!logeIstVerfuegbarFuerSlot(logeInfo?.verfuegbarkeit_regel ?? null, new Date(neuesDatum + 'T00:00:00'), neuerZeitslot)) {
      return NextResponse.json({ hinweis: 'Diese Loge ist an diesem Tag/Zeitslot nicht verfügbar. Bitte einen anderen Termin oder eine andere Loge wählen.' })
    }

    const logeKapazitaetRelevant = reservierung.typ !== 'GRUPPE' && reservierung.typ !== 'INTERN'

    if (logeKapazitaetRelevant) {
      const { data: aktiveBelegungen } = await supabaseAdmin
        .from('reservierungen')
        .select('kinder_anzahl')
        .eq('loge_id', neueLogeId)
        .eq('datum', neuesDatum)
        .eq('zeitslot', neuerZeitslot)
        .neq('status', 'STORNIERT')
        .neq('id', body.id)

      const belegungen = aktiveBelegungen ?? []
      const bereitsKinder = belegungen.reduce((s, r) => s + r.kinder_anzahl, 0)

      if (logeInfo?.kapazitaet_flexibel) {
        if (belegungen.length >= 1) {
          return NextResponse.json({ hinweis: 'Dieser Slot ist bereits belegt. Bitte einen anderen Termin oder eine andere Loge wählen.' })
        }
      } else {
        const maxKinder = logeInfo?.max_kinder ?? 16
        if (belegungen.length >= 2) {
          return NextResponse.json({ hinweis: 'Dieser Slot ist bereits mit zwei Gruppen belegt. Bitte einen anderen Termin oder eine andere Loge wählen.' })
        }
        if (belegungen.length === 1) {
          if (belegungen[0].kinder_anzahl >= 10) {
            return NextResponse.json({ hinweis: 'Diese Loge ist für diesen Slot exklusiv belegt (10+ Kinder). Bitte einen anderen Termin oder eine andere Loge wählen.' })
          }
          if (kinderAnzahl >= 10) {
            return NextResponse.json({ hinweis: `In dieser Loge/diesem Slot gibt es bereits eine Gruppe mit ${belegungen[0].kinder_anzahl} Kindern. Eine exklusive Buchung (10+ Kinder) ist nicht mehr möglich.` })
          }
          if (bereitsKinder + kinderAnzahl > maxKinder) {
            return NextResponse.json({ hinweis: `In dieser Loge sind bereits ${bereitsKinder} Kinder gebucht. Maximal ${maxKinder - bereitsKinder} weitere Kinder möglich.` })
          }
        }
        if (belegungen.length === 0 && kinderAnzahl > maxKinder) {
          return NextResponse.json({ hinweis: `Diese Loge fasst maximal ${maxKinder} Kinder. Bitte eine andere Loge vorschlagen oder die Gruppe aufteilen.` })
        }
      }
    }
  }

  const teuerterTag = await istPreisteuerterTag(new Date(neuesDatum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, teuerterTag, erwachseneAnzahl)
  const anzahlungBetrag = berechneAnzahlung(gesamtbetrag)

  const updates: Record<string, unknown> = {
    loge_id: neueLogeId,
    kinder_anzahl: kinderAnzahl,
    erwachsene_anzahl: erwachseneAnzahl,
    gesamtbetrag,
    anzahlung_betrag: anzahlungBetrag,
    notizen: body.notizen ?? reservierung.notizen,
    aktualisiert_am: new Date().toISOString(),
  }
  if (body.datum) updates.datum = body.datum
  if (body.zeitslot) updates.zeitslot = body.zeitslot

  await supabaseAdmin.from('reservierungen').update(updates).eq('id', body.id)

  console.log(`[change_reservation] id=${body.id} | neues Datum=${neuesDatum} | Zeitslot=${neuerZeitslot} | Loge=${neueLogeId}`)
  return NextResponse.json({ erfolg: true, datum: neuesDatum, zeitslot: neuerZeitslot, gesamtbetrag, anzahlung: anzahlungBetrag })
}
