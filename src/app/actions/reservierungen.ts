'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { erstelleAnzahlungsSession } from '@/lib/stripe/client'
import type { ReservierungTyp } from '@/types/reservierung'

export type ReservierungFormState = {
  fehler?: string
} | undefined

export async function reservierungErstellen(
  _state: ReservierungFormState,
  formData: FormData,
): Promise<ReservierungFormState> {
  // Authentifizierung prüfen
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fehler: 'Nicht angemeldet.' }

  // Formulardaten lesen
  const datum = formData.get('datum') as string
  const logeId = formData.get('loge_id') as string
  const zeitslot = Number(formData.get('zeitslot'))
  const typ = formData.get('typ') as ReservierungTyp
  const kinderAnzahl = Number(formData.get('kinder_anzahl'))
  const erwachseneAnzahl = Number(formData.get('erwachsene_anzahl'))
  const vorname = (formData.get('vorname') as string).trim()
  const nachname = (formData.get('nachname') as string).trim()
  const telefon = (formData.get('telefon') as string).trim()
  const email = (formData.get('email') as string | null)?.trim() || null
  const kindGeburtstag = (formData.get('kind_geburtstag') as string | null) || null
  const dsgvo = formData.get('dsgvo') === 'on'
  const notizen = (formData.get('notizen') as string | null)?.trim() || null

  // Validierung
  if (!datum || !logeId || !zeitslot || !typ || !vorname || !nachname || !telefon) {
    return { fehler: 'Bitte alle Pflichtfelder ausfüllen.' }
  }
  if (!dsgvo) {
    return { fehler: 'DSGVO-Einwilligung ist erforderlich.' }
  }
  if (kinderAnzahl < 1) {
    return { fehler: 'Mindestens 1 Kind erforderlich.' }
  }

  // Doppelbelegung prüfen
  const { data: aktiveBelegungen } = await supabaseAdmin
    .from('reservierungen')
    .select('kinder_anzahl')
    .eq('loge_id', logeId)
    .eq('datum', datum)
    .eq('zeitslot', zeitslot)
    .neq('status', 'STORNIERT')

  const belegungen = aktiveBelegungen ?? []
  const bereitsKinder = belegungen.reduce((s, r) => s + r.kinder_anzahl, 0)

  if (belegungen.length >= 2) {
    return { fehler: 'Dieser Slot ist bereits mit zwei Gruppen belegt.' }
  }
  if (belegungen.length === 1) {
    if (belegungen[0].kinder_anzahl >= 10) {
      return { fehler: 'Diese Loge ist für diesen Slot exklusiv belegt (10+ Kinder).' }
    }
    if (kinderAnzahl >= 10) {
      return { fehler: `In dieser Loge gibt es bereits eine Gruppe mit ${belegungen[0].kinder_anzahl} Kindern. Exklusive Buchung nicht möglich.` }
    }
    if (bereitsKinder + kinderAnzahl > 20) {
      return { fehler: `In dieser Loge sind bereits ${bereitsKinder} Kinder gebucht. Maximal ${20 - bereitsKinder} weitere möglich.` }
    }
  }

  // Preisberechnung (inkl. NRW Feiertage und Schulferien)
  const weekend = await istPreisteuerterTag(new Date(datum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, weekend, erwachseneAnzahl)
  const anzahlungBetrag = berechneAnzahlung(gesamtbetrag)
  const paketPreisProKind = weekend ? 27.0 : 23.0

  // Kunde per Telefon suchen oder neu anlegen
  const { data: vorhandenerKunde } = await supabaseAdmin
    .from('kunden')
    .select('id')
    .eq('telefon', telefon)
    .maybeSingle()

  let kundeId: string

  if (vorhandenerKunde) {
    // Bestandskunde aktualisieren
    await supabaseAdmin
      .from('kunden')
      .update({ vorname, nachname, email, kind_geburtstag: kindGeburtstag, dsgvo_einwilligung: dsgvo })
      .eq('id', vorhandenerKunde.id)
    kundeId = vorhandenerKunde.id
  } else {
    // Neukunde anlegen
    const { data: neuerKunde, error: kundeError } = await supabaseAdmin
      .from('kunden')
      .insert({
        vorname,
        nachname,
        telefon,
        email,
        kind_geburtstag: kindGeburtstag,
        standort_id: WUPPERTAL_STANDORT_ID,
        dsgvo_einwilligung: dsgvo,
        newsletter_opt_in: false,
      })
      .select('id')
      .single()

    if (kundeError || !neuerKunde) {
      return { fehler: `Kunde konnte nicht gespeichert werden: ${kundeError?.message}` }
    }
    kundeId = neuerKunde.id
  }

  const neuerStatus = typ === 'INTERN' ? 'INTERN_GESPERRT' : typ === 'GRUPPE' ? 'GRUPPENANGEBOT' : 'BESTAETIGT_AUSSTEHEND'
  const reservierungsDaten = {
    standort_id: WUPPERTAL_STANDORT_ID,
    loge_id: logeId,
    kunde_id: kundeId,
    typ,
    status: neuerStatus,
    datum,
    zeitslot,
    kinder_anzahl: kinderAnzahl,
    erwachsene_anzahl: erwachseneAnzahl,
    paket_preis_pro_kind: paketPreisProKind,
    gesamtbetrag,
    anzahlung_betrag: anzahlungBetrag,
    notizen,
    stripe_payment_link: null,
    stripe_payment_intent_id: null,
    aktualisiert_am: new Date().toISOString(),
  }

  // Prüfen ob stornierte Reservierung für diesen Slot existiert → wiederverwenden
  const { data: storniertVorhanden } = await supabaseAdmin
    .from('reservierungen')
    .select('id')
    .eq('loge_id', logeId)
    .eq('datum', datum)
    .eq('zeitslot', zeitslot)
    .eq('status', 'STORNIERT')
    .maybeSingle()

  let reservierung: { id: string } | null = null
  let resError = null

  if (storniertVorhanden) {
    const { data, error } = await supabaseAdmin
      .from('reservierungen')
      .update(reservierungsDaten)
      .eq('id', storniertVorhanden.id)
      .select('id')
      .single()
    reservierung = data
    resError = error
  } else {
    const { data, error } = await supabaseAdmin
      .from('reservierungen')
      .insert({ ...reservierungsDaten, erstellt_von: user.id })
      .select('id')
      .single()
    reservierung = data
    resError = error
  }

  if (resError || !reservierung) {
    return { fehler: `Fehler beim Speichern: ${resError?.message ?? 'Unbekannter Fehler'}` }
  }

  // Stripe Anzahlungs-Link generieren (nur für Geburtstag-Typen)
  if (typ === 'GEBURTSTAG' || typ === 'BABYWELT_GEBURTSTAG') {
    try {
      const loge = await supabaseAdmin
        .from('logen')
        .select('name')
        .eq('id', logeId)
        .single()

      const beschreibung = `Anzahlung Geburtstag – ${loge.data?.name ?? 'Loge'}, ${new Date(datum + 'T00:00:00').toLocaleDateString('de-DE')}`

      const stripeUrl = await erstelleAnzahlungsSession({
        betragCent: Math.round(anzahlungBetrag * 100),
        reservierungId: reservierung.id,
        beschreibung,
        kundenEmail: email ?? undefined,
      })

      console.log('[Stripe] URL generiert:', stripeUrl)

      const { error: updateError } = await supabaseAdmin
        .from('reservierungen')
        .update({ stripe_payment_link: stripeUrl })
        .eq('id', reservierung.id)

      if (updateError) {
        console.error('[Stripe] Update fehlgeschlagen:', updateError.message)
      }
    } catch (err) {
      console.error('[Stripe] Fehler beim Erstellen des Zahlungslinks:', err)
      // Stripe-Fehler blockieren nicht — Reservierung ist bereits gespeichert
    }
  }

  const datumAnzeige = new Date(datum + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const zeitAnzeige = zeitslot === 1 ? '10:30–14:30' : '15:00–19:00'
  const zeitslotText = zeitslot === 1 ? 'Slot 1 — 10:30–14:30 Uhr' : 'Slot 2 — 15:00–19:00 Uhr'

  // Bestätigungs-SMS an Kunde senden
  try {
    const { sendeSMS } = await import('@/lib/twilio/client')
    await sendeSMS(
      telefon,
      `Hallo ${vorname}, Ihre Reservierung bei Upsalla Kinderpark Wuppertal am ${datumAnzeige} (${zeitAnzeige}) für ${kinderAnzahl} Kinder ist bestätigt. Anzahlung: ${anzahlungBetrag.toFixed(2)} €. Bei Fragen: 0202 2623339`,
    )
  } catch (err) {
    console.error('[Twilio] SMS-Fehler:', err)
  }

  // Bestätigungs-E-Mail an Kunde senden (nur wenn E-Mail vorhanden)
  if (email) {
    try {
      const { sendeEmail } = await import('@/lib/resend/client')
      const { buchungsbestaetigungHtml } = await import('@/lib/resend/templates')

      // Aktuellen Stripe-Link lesen (wurde ggf. gerade gesetzt)
      const { data: aktuelleRes } = await supabaseAdmin
        .from('reservierungen')
        .select('stripe_payment_link, logen(name)')
        .eq('id', reservierung.id)
        .single()

      const logeData = aktuelleRes?.logen
      const logeName = (Array.isArray(logeData) ? logeData[0] : logeData as unknown as { name: string } | null)?.name ?? 'Loge'

      await sendeEmail({
        an: email,
        betreff: `Buchungsbestätigung – ${datumAnzeige} · Upsalla Kinderpark Wuppertal`,
        html: buchungsbestaetigungHtml({
          vorname,
          nachname,
          datum: datumAnzeige,
          zeitslot: zeitslotText,
          logeName,
          kinderAnzahl,
          erwachseneAnzahl,
          gesamtbetrag,
          anzahlungBetrag,
          stripePaymentLink: aktuelleRes?.stripe_payment_link ?? null,
        }),
      })
    } catch (err) {
      console.error('[Resend] E-Mail-Fehler:', err)
    }
  }

  revalidatePath('/')
  redirect(`/reservierungen/${reservierung.id}`)
}

export type BearbeitenState = { fehler?: string } | undefined

export async function reservierungAktualisieren(
  _state: BearbeitenState,
  formData: FormData,
): Promise<BearbeitenState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { fehler: 'Nicht angemeldet.' }

  const id = formData.get('id') as string
  const datum = formData.get('datum') as string
  const typ = formData.get('typ') as ReservierungTyp
  const kinderAnzahl = Number(formData.get('kinder_anzahl'))
  const erwachseneAnzahl = Number(formData.get('erwachsene_anzahl'))
  const notizen = (formData.get('notizen') as string)?.trim() || null
  const vorname = (formData.get('vorname') as string).trim()
  const nachname = (formData.get('nachname') as string).trim()
  const telefon = (formData.get('telefon') as string).trim()
  const email = (formData.get('email') as string)?.trim() || null
  const kundeId = formData.get('kunde_id') as string

  if (kinderAnzahl < 1) return { fehler: 'Mindestens 1 Kind erforderlich.' }

  const weekend = await istPreisteuerterTag(new Date(datum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, weekend, erwachseneAnzahl)
  const anzahlungBetrag = berechneAnzahlung(gesamtbetrag)
  const paketPreisProKind = weekend ? 27.0 : 23.0

  // Kundendaten aktualisieren
  await supabaseAdmin
    .from('kunden')
    .update({ vorname, nachname, email })
    .eq('id', kundeId)

  // Reservierung aktualisieren
  const { error } = await supabaseAdmin
    .from('reservierungen')
    .update({
      typ,
      kinder_anzahl: kinderAnzahl,
      erwachsene_anzahl: erwachseneAnzahl,
      paket_preis_pro_kind: paketPreisProKind,
      gesamtbetrag,
      anzahlung_betrag: anzahlungBetrag,
      notizen,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { fehler: `Fehler: ${error.message}` }

  revalidatePath('/')
  revalidatePath(`/reservierungen/${id}`)
  redirect(`/reservierungen/${id}`)
}

export async function verifizierteZahlung(reservierungId: string, sessionId: string): Promise<void> {
  try {
    const { stripe } = await import('@/lib/stripe/client')
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status === 'paid' && session.metadata?.reservierung_id === reservierungId) {
      await supabaseAdmin
        .from('reservierungen')
        .update({
          status: 'BESTAETIGT_BEZAHLT',
          stripe_payment_intent_id: session.payment_intent as string ?? null,
        })
        .eq('id', reservierungId)

      // E-Mail aus Stripe Checkout in Kundendatenbank übernehmen
      const stripeEmail = session.customer_details?.email
      if (stripeEmail) {
        const { data: res } = await supabaseAdmin
          .from('reservierungen')
          .select('kunde_id')
          .eq('id', reservierungId)
          .single()

        if (res?.kunde_id) {
          await supabaseAdmin
            .from('kunden')
            .update({ email: stripeEmail })
            .eq('id', res.kunde_id)
        }
      }

      revalidatePath(`/reservierungen/${reservierungId}`)
      revalidatePath('/')
    }
  } catch (err) {
    console.error('[Stripe] Zahlungsverifizierung fehlgeschlagen:', err)
  }
}

export async function reservierungStornieren(
  id: string,
  mitAttest = false,
): Promise<{ rueckerstattungBetrag: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet.')

  // Alle nötigen Daten vorab laden
  const { data: res } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, zeitslot, anzahlung_betrag, stripe_payment_intent_id, kunden(vorname, telefon, email), logen(name)')
    .eq('id', id)
    .single()

  if (!res) throw new Error('Reservierung nicht gefunden.')

  // 7-Tage-Regel prüfen
  const terminDatum = new Date(res.datum + 'T00:00:00')
  const heute = new Date(); heute.setHours(0, 0, 0, 0)
  const tageVorher = Math.ceil((terminDatum.getTime() - heute.getTime()) / (1000 * 60 * 60 * 24))
  const kostenlosStorno = tageVorher >= 7 || mitAttest

  // Stripe-Rückerstattung auslösen wenn berechtigt
  let rueckerstattungBetrag = 0
  if (kostenlosStorno && res.stripe_payment_intent_id && (res.anzahlung_betrag ?? 0) > 0) {
    try {
      const { erstelleRueckerstattung } = await import('@/lib/stripe/client')
      await erstelleRueckerstattung(res.stripe_payment_intent_id)
      rueckerstattungBetrag = res.anzahlung_betrag ?? 0
    } catch (err) {
      console.error('[Stripe] Rückerstattung fehlgeschlagen:', err)
    }
  }

  await supabaseAdmin
    .from('reservierungen')
    .update({ status: 'STORNIERT' })
    .eq('id', id)

  const kunde = (Array.isArray(res.kunden) ? res.kunden[0] : res.kunden) as { vorname: string; telefon: string | null; email: string | null } | null
  const logeRaw = res.logen
  const loge = (Array.isArray(logeRaw) ? logeRaw[0] : logeRaw) as unknown as { name: string } | null

  const datumAnzeige = terminDatum.toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const zeitAnzeige = res.zeitslot === 1 ? '10:30–14:30' : '15:00–19:00'
  const zeitslotText = res.zeitslot === 1 ? 'Slot 1 — 10:30–14:30 Uhr' : 'Slot 2 — 15:00–19:00 Uhr'

  // Storno-SMS
  if (kunde?.telefon) {
    try {
      const { sendeSMS } = await import('@/lib/twilio/client')
      const smsText = rueckerstattungBetrag > 0
        ? `Hallo ${kunde.vorname}, Ihre Reservierung am ${datumAnzeige} (${zeitAnzeige} Uhr) wurde storniert. Die Anzahlung von ${rueckerstattungBetrag.toFixed(2)} € wird innerhalb von 5–10 Werktagen erstattet.`
        : `Hallo ${kunde.vorname}, Ihre Reservierung am ${datumAnzeige} (${zeitAnzeige} Uhr) wurde storniert. Bei Fragen: 0202 2623339`
      await sendeSMS(kunde.telefon, smsText)
    } catch (err) {
      console.error('[Twilio] Storno-SMS-Fehler:', err)
    }
  }

  // Storno-E-Mail
  if (kunde?.email) {
    try {
      const { sendeEmail } = await import('@/lib/resend/client')
      const { stornobestaetigungHtml } = await import('@/lib/resend/templates')

      await sendeEmail({
        an: kunde.email,
        betreff: `Stornierungsbestätigung – ${datumAnzeige} · Upsalla Kinderpark Wuppertal`,
        html: stornobestaetigungHtml({
          vorname: kunde.vorname,
          datum: datumAnzeige,
          zeitslot: zeitslotText,
          logeName: loge?.name ?? 'Loge',
          rueckerstattungBetrag: rueckerstattungBetrag > 0 ? rueckerstattungBetrag : undefined,
        }),
      })
    } catch (err) {
      console.error('[Resend] Storno-E-Mail-Fehler:', err)
    }
  }

  revalidatePath('/')
  revalidatePath(`/reservierungen/${id}`)
  return { rueckerstattungBetrag }
}

// Barzahlung vor Ort bestätigen — kein Stripe, kein SMS
export async function barzahlungBestaetigen(id: string): Promise<void> {
  const { data: r } = await supabaseAdmin
    .from('reservierungen')
    .select('notizen')
    .eq('id', id)
    .single()

  const neueNotiz = r?.notizen
    ? `${r.notizen} | Barzahlung vor Ort`
    : 'Barzahlung vor Ort'

  await supabaseAdmin
    .from('reservierungen')
    .update({ status: 'BESTAETIGT_BEZAHLT', notizen: neueNotiz })
    .eq('id', id)

  revalidatePath('/')
  revalidatePath(`/reservierungen/${id}`)
}
