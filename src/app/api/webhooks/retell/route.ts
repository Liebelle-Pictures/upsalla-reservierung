import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const payload = await request.text()

  // Signaturprüfung (falls RETELL_WEBHOOK_SECRET gesetzt)
  const secret = process.env.RETELL_WEBHOOK_SECRET
  if (secret) {
    const signatur = request.headers.get('x-retell-signature')
    if (!signatur) {
      return NextResponse.json({ fehler: 'Keine Signatur' }, { status: 401 })
    }
    const erwartet = createHmac('sha256', secret).update(payload).digest('base64')
    if (signatur !== erwartet) {
      return NextResponse.json({ fehler: 'Ungültige Signatur' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(payload)
  } catch {
    return NextResponse.json({ fehler: 'Ungültiges JSON' }, { status: 400 })
  }

  const event = body.event as string
  const call = body.call as Record<string, unknown> | undefined

  // call_started: Anrufer-Nummer erkennen und als dynamische Variablen zurückgeben
  if (event === 'call_started') {
    const fromNumber = (call?.from_number as string | undefined) ?? null
    console.log('[Retell] call_started | from_number:', fromNumber)

    if (!fromNumber) {
      return NextResponse.json({
        llm_dynamic_variables: { caller_phone: 'unbekannt', ist_mobil: 'nein' },
      })
    }

    const istMobil = /^\+49(15|16|17)\d/.test(fromNumber)
    const rest = fromNumber.startsWith('+49') ? fromNumber.slice(3) : fromNumber
    const callerPhone = fromNumber.startsWith('+49')
      ? `+49 ${rest.slice(0, 3)} ${rest.slice(3)}`
      : fromNumber

    return NextResponse.json({
      llm_dynamic_variables: {
        caller_phone: callerPhone,
        ist_mobil: istMobil ? 'ja' : 'nein',
      },
    })
  }

  if (!call || (event !== 'call_ended' && event !== 'call_analyzed')) {
    return NextResponse.json({ ignoriert: true })
  }

  const callId    = call.call_id as string
  const vonNummer = (call.from_number as string | undefined) ?? null
  const startMs   = (call.start_timestamp as number | undefined) ?? Date.now()
  const endeMs    = (call.end_timestamp as number | undefined) ?? Date.now()
  const dauerSek  = Math.round((endeMs - startMs) / 1000)
  const datum     = new Date(startMs).toISOString().slice(0, 10)

  const analyse      = call.call_analysis as Record<string, unknown> | undefined
  const erfolgreich  = (analyse?.call_successful as boolean | undefined) ?? false
  const inVoicemail  = (analyse?.in_voicemail as boolean | undefined) ?? false
  const callSummary  = (analyse?.call_summary as string | undefined) ?? null

  // ── Post Call Extraction Daten (von Retell KI aus Transcript extrahiert) ──
  const extraktion = analyse?.custom_analysis_data as Record<string, unknown> | undefined

  const extraktionVerfuegbar = extraktion !== undefined && extraktion !== null

  // reservierung_erstellt: Retell-Extraktion hat Vorrang vor Heuristik
  let reservierungErstellt: boolean

  if (extraktionVerfuegbar && typeof extraktion?.reservierung_erstellt === 'boolean') {
    // Primärquelle: Retell hat aus dem Transcript extrahiert
    reservierungErstellt = extraktion.reservierung_erstellt
  } else {
    // Fallback: DB-Heuristik (Reservierung im Zeitfenster des Anrufs)
    reservierungErstellt = false
    if (vonNummer && !inVoicemail) {
      const telefonnormiert = vonNummer.replace(/\s+/g, '').replace(/^\+49/, '0')
      const vonZeit = new Date(startMs - 2 * 60 * 1000).toISOString()
      const bisZeit = new Date(endeMs + 15 * 60 * 1000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: res } = await (supabaseAdmin as any)
        .from('reservierungen')
        .select('id')
        .is('erstellt_von', null)
        .gte('erstellt_am', vonZeit)
        .lte('erstellt_am', bisZeit)
        .limit(1)

      if (res && res.length > 0) {
        reservierungErstellt = true
      } else {
        const { data: kunde } = await supabaseAdmin
          .from('kunden')
          .select('id')
          .or(`telefon.eq.${vonNummer},telefon.eq.${telefonnormiert}`)
          .maybeSingle()

        if (kunde) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: resKunde } = await (supabaseAdmin as any)
            .from('reservierungen')
            .select('id')
            .eq('kunde_id', kunde.id)
            .is('erstellt_von', null)
            .gte('erstellt_am', vonZeit)
            .lte('erstellt_am', bisZeit)
            .limit(1)

          reservierungErstellt = (resKunde?.length ?? 0) > 0
        }
      }
    }
  }

  // zusammenfassung: Grund (falls keine Reservierung) + Call-Summary kombinieren
  const grundKeinAbschluss = extraktion?.grund_kein_abschluss as string | undefined
  const zusammenfassungTeile: string[] = []
  if (grundKeinAbschluss && grundKeinAbschluss !== 'sonstiges' && !reservierungErstellt) {
    const grundLeserlich: Record<string, string> = {
      datum_nicht_verfuegbar: 'Datum nicht verfügbar',
      kunde_unentschlossen:   'Kunde unentschlossen',
      falscher_anruf:         'Falscher Anruf',
      kunde_ruft_zurueck:     'Kunde ruft zurück',
      technischer_fehler:     'Technischer Fehler',
    }
    zusammenfassungTeile.push(`Grund: ${grundLeserlich[grundKeinAbschluss] ?? grundKeinAbschluss}`)
  }
  if (callSummary) zusammenfassungTeile.push(callSummary)
  const zusammenfassung = zusammenfassungTeile.join(' · ') || null

  // Anruf speichern (upsert — call_analyzed kommt nach call_ended und überschreibt)
  const { error } = await supabaseAdmin
    .from('lena_anrufe')
    .upsert({
      call_id:               callId,
      datum,
      dauer_sekunden:        dauerSek,
      telefon:               vonNummer,
      reservierung_erstellt: reservierungErstellt,
      anruf_erfolgreich:     erfolgreich,
      in_voicemail:          inVoicemail,
      zusammenfassung,
    }, { onConflict: 'call_id' })

  if (error) {
    console.error('[Retell Webhook] DB-Fehler:', error.message)
    return NextResponse.json({ fehler: 'DB-Fehler' }, { status: 500 })
  }

  const quelle = extraktionVerfuegbar ? 'Retell-Extraktion' : 'DB-Heuristik'
  console.log(`[Retell] ${event} | ${datum} | ${dauerSek}s | Reservierung: ${reservierungErstellt} (${quelle})`)
  return NextResponse.json({ gespeichert: true })
}
