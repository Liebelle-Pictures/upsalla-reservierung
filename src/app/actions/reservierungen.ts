'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { berechneGesamtbetrag, berechneAnzahlung } from '@/lib/utils/preise'
import { istWochenende } from '@/lib/utils/zeitslots'
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

  // Preisberechnung
  const weekend = istWochenende(new Date(datum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, weekend)
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

  const neuerStatus = typ === 'GRUPPE' || typ === 'INTERN' ? 'GRUPPENANGEBOT' : 'BESTAETIGT_AUSSTEHEND'
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
    if (resError?.code === '23505') {
      return { fehler: 'Diese Loge ist für den gewählten Zeitslot bereits belegt.' }
    }
    return { fehler: `Fehler beim Speichern: ${resError?.message}` }
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

  const weekend = istWochenende(new Date(datum + 'T00:00:00'))
  const gesamtbetrag = berechneGesamtbetrag(kinderAnzahl, weekend)
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
      revalidatePath(`/reservierungen/${reservierungId}`)
      revalidatePath('/')
    }
  } catch (err) {
    console.error('[Stripe] Zahlungsverifizierung fehlgeschlagen:', err)
  }
}

export async function reservierungStornieren(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet.')

  await supabaseAdmin
    .from('reservierungen')
    .update({ status: 'STORNIERT' })
    .eq('id', id)

  revalidatePath('/')
  revalidatePath(`/reservierungen/${id}`)
}
