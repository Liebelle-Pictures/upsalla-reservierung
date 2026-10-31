// POST /api/buchen/[standort]/reservieren — legt eine Online-Buchung an (GELB, Hold 35 Min.)
// und gibt den Stripe-Checkout-Link für die Anzahlung zurück. Siehe docs/module/online-buchung.md, 5.3.
//
// Antwort 200: { checkout_url }
// Antwort 409: { grund, hinweis } — grund sagt dem Widget, was zu tun ist:
//   ABGELAUFEN / SCHLUESSEL_VERWENDET → neuen idempotenz_schluessel erzeugen, Buchung neu starten
//   SLOT_BELEGT / KAPAZITAET / LOGE_UNGUELTIG → zurück zu Schritt 2, Verfügbarkeit neu laden
//   IN_BEARBEITUNG → kurz warten und denselben Request wiederholen
//   BEREITS_BEZAHLT → nichts mehr tun, Bestätigung kommt per SMS/E-Mail
// Antwort 400 mit feld 'turnstile_token' → Widget zurücksetzen, neu absenden
// Antwort 429 → Rate-Limit (5 Versuche / 10 Min. pro IP-Hash)
// Antwort 503 → Schutz-Konfiguration fehlt (Turnstile/IP-Salt), Buchung nicht möglich
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ladeOnlineStandort } from '@/lib/online-buchung/standort'
import { validiereBuchungsanfrage, slotExistiert, telefonSchluessel, type Buchungsanfrage } from '@/lib/online-buchung/validierung'
import { HOLD_MINUTEN, STRIPE_GUELTIGKEIT_SEKUNDEN } from '@/lib/online-buchung/konfiguration'
import { storniereUnbezahlteOnlineBuchung } from '@/lib/online-buchung/bestaetigung'
import { pruefeSchutz } from '@/lib/online-buchung/schutz'
import { berechneVerfuegbarkeit } from '@/lib/verfuegbarkeit'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { logeIstVerfuegbarFuerSlot, zeitslotZeitraum } from '@/lib/utils/zeitslots'
import { berechneGesamtbetrag, berechneAnzahlung, KIND_PREIS_WOCHENENDE, KIND_PREIS_WOCHENTAG } from '@/lib/utils/preise'
import { stripe, erstelleAnzahlungsSession } from '@/lib/stripe/client'
import { ermittleSofortZahlarten } from '@/lib/stripe/zahlungsarten'

export const dynamic = 'force-dynamic'

const KEIN_CACHE = { 'Cache-Control': 'no-store' }

type Grund = 'ABGELAUFEN' | 'SCHLUESSEL_VERWENDET' | 'SLOT_BELEGT' | 'KAPAZITAET' | 'LOGE_UNGUELTIG' | 'IN_BEARBEITUNG' | 'BEREITS_BEZAHLT'

const HINWEIS_ABGELAUFEN = 'Die Zeit ist abgelaufen, bitte startet die Buchung neu.'
const HINWEIS_SLOT_BELEGT = 'Diese Loge ist zu dieser Zeit leider schon vergeben. Wählt bitte eine andere Loge oder einen anderen Termin.'

function konflikt(grund: Grund, hinweis: string) {
  return NextResponse.json({ grund, hinweis }, { status: 409, headers: KEIN_CACHE })
}
function fehler(status: number, hinweis: string, feld?: string) {
  return NextResponse.json({ fehler: true, hinweis, ...(feld ? { feld } : {}) }, { status, headers: KEIN_CACHE })
}

interface BestehendeBuchung {
  id: string
  status: string
  datum: string
  zeitslot: number
  loge_id: string
  kinder_anzahl: number
  erwachsene_anzahl: number
  stripe_session_id: string | null
  online_hold_bis: string | null
}

// Doppeltes Absenden (gleicher idempotenz_schluessel): denselben, noch gültigen Checkout-Link
// zurückgeben. Abgelaufen/storniert → 409 ABGELAUFEN, das Widget startet mit neuem Schlüssel.
async function antwortFuerBestehendeBuchung(b: BestehendeBuchung, anfrage: Buchungsanfrage): Promise<NextResponse> {
  const gleicheDaten = b.datum === anfrage.datum && b.zeitslot === anfrage.zeitslot && b.loge_id === anfrage.loge_id
    && b.kinder_anzahl === anfrage.kinder_anzahl && b.erwachsene_anzahl === anfrage.erwachsene_anzahl
  if (!gleicheDaten) return konflikt('SCHLUESSEL_VERWENDET', 'Bitte startet die Buchung neu.')
  if (b.status === 'BESTAETIGT_BEZAHLT') return konflikt('BEREITS_BEZAHLT', 'Diese Buchung ist bereits bezahlt. Die Bestätigung kommt per SMS und E-Mail.')
  if (b.status !== 'BESTAETIGT_AUSSTEHEND') return konflikt('ABGELAUFEN', HINWEIS_ABGELAUFEN)

  if (!b.stripe_session_id) {
    // Der erste Request erstellt die Stripe-Session gerade noch (Doppelklick) — oder ist dabei
    // abgestürzt. Solange der Hold läuft: warten lassen; danach ist sie abgelaufen.
    const holdLaeuft = !!b.online_hold_bis && new Date(b.online_hold_bis) > new Date()
    return holdLaeuft ? konflikt('IN_BEARBEITUNG', 'Eure Buchung wird gerade verarbeitet. Bitte einen Moment warten.') : konflikt('ABGELAUFEN', HINWEIS_ABGELAUFEN)
  }

  const session = await stripe.checkout.sessions.retrieve(b.stripe_session_id)
  if (session.status === 'complete') return konflikt('BEREITS_BEZAHLT', 'Diese Buchung ist bereits bezahlt. Die Bestätigung kommt per SMS und E-Mail.')
  if (session.status === 'open' && session.url) {
    return NextResponse.json({ checkout_url: session.url }, { headers: KEIN_CACHE })
  }
  // Session abgelaufen: Slot sofort freigeben (der Webhook würde es auch tun)
  await storniereUnbezahlteOnlineBuchung(b.id, b.stripe_session_id)
  return konflikt('ABGELAUFEN', HINWEIS_ABGELAUFEN)
}

const BESTEHEND_SPALTEN = 'id, status, datum, zeitslot, loge_id, kinder_anzahl, erwachsene_anzahl, stripe_session_id, online_hold_bis'

async function ladeBuchungPerSchluessel(schluessel: string): Promise<BestehendeBuchung | null> {
  const { data } = await supabaseAdmin.from('reservierungen').select(BESTEHEND_SPALTEN).eq('idempotenz_schluessel', schluessel).maybeSingle()
  return (data as BestehendeBuchung | null) ?? null
}

// Bestandskunde per Telefon suchen. Telefonnummern liegen gemischt vor ("0152 1234567",
// "+49152...", "0152..."), daher grob per ILIKE auf die letzten Ziffern vorfiltern und
// dann exakt über E.164 vergleichen. Bei mehreren Treffern: der älteste Kunde.
async function findeKunde(standortId: string, telefon: string): Promise<{ id: string; vorname: string; nachname: string; email: string | null } | null> {
  const schluessel = telefonSchluessel(telefon)
  const letzteZiffern = schluessel.replace(/\D/g, '').slice(-9)
  const muster = `%${letzteZiffern.split('').join('%')}%`
  const { data, error } = await supabaseAdmin
    .from('kunden')
    .select('id, vorname, nachname, telefon, email, erstellt_am')
    .eq('standort_id', standortId)
    .ilike('telefon', muster)
    .order('erstellt_am', { ascending: true })
    .limit(50)
  if (error) throw new Error(`Kundensuche fehlgeschlagen: ${error.message}`)
  const treffer = (data ?? []).find(k => k.telefon && telefonSchluessel(k.telefon) === schluessel)
  return treffer ? { id: treffer.id, vorname: treffer.vorname, nachname: treffer.nachname, email: treffer.email } : null
}

function gleich(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/buchen/[standort]/reservieren'>) {
  const { standort: slug } = await ctx.params
  const standort = await ladeOnlineStandort(slug)
  if (!standort) return NextResponse.json({ fehler: 'Nicht gefunden' }, { status: 404, headers: KEIN_CACHE })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fehler(400, 'Ungültige Anfrage.')
  }

  // Honeypot: echte Nutzer sehen das Feld nicht, Bots füllen es aus
  const website = (body as { website?: unknown } | null)?.website
  if (website !== undefined && website !== null && website !== '') return fehler(400, 'Ungültige Anfrage.')

  const validierung = validiereBuchungsanfrage(body)
  if (!validierung.ok) return fehler(400, validierung.hinweis, validierung.feld)
  const a = validierung.daten

  try {
    // 1. Doppeltes Absenden zuerst behandeln (sonst wäre der eigene Slot "belegt")
    // Kein Turnstile/Rate-Limit nötig: der Schlüssel stammt aus einem bereits geprüften Request
    // (Turnstile-Tokens sind nur einmal gültig, Wiederholungen hätten sonst keine Chance).
    const bestehend = await ladeBuchungPerSchluessel(a.idempotenz_schluessel)
    if (bestehend) return await antwortFuerBestehendeBuchung(bestehend, a)

    // 1b. Neuer Buchungsversuch: Rate-Limit + Turnstile
    const schutz = await pruefeSchutz(request.headers, (body as { turnstile_token?: unknown }).turnstile_token)
    if (!schutz.ok) return fehler(schutz.status, schutz.hinweis, schutz.feld)

    // 2. Loge + Slot-Regeln (verfuegbarkeit_regel prüft reserviere_online NICHT, daher hier)
    const { data: loge } = await supabaseAdmin
      .from('logen')
      .select('id, name, standort_id, aktiv, online_buchbar, verfuegbarkeit_regel')
      .eq('id', a.loge_id)
      .maybeSingle()
    if (!loge || !loge.aktiv || !loge.online_buchbar || loge.standort_id !== standort.id) {
      return konflikt('LOGE_UNGUELTIG', 'Diese Loge kann online nicht gebucht werden.')
    }
    const datumObj = new Date(a.datum + 'T00:00:00')
    const teuer = await istPreisteuerterTag(datumObj)
    if (!slotExistiert(a.datum, a.zeitslot, teuer)) return fehler(400, 'Diese Uhrzeit gibt es an diesem Tag nicht.', 'zeitslot')
    if (!logeIstVerfuegbarFuerSlot(loge.verfuegbarkeit_regel, datumObj, a.zeitslot)) {
      return konflikt('LOGE_UNGUELTIG', 'Diese Loge kann zu dieser Uhrzeit nicht gebucht werden. Wählt bitte eine andere Loge oder Uhrzeit.')
    }

    // 3. Vorabprüfung wie im Widget (gleiche Regeln). Entscheidend ist danach reserviere_online.
    const verf = await berechneVerfuegbarkeit({ standortId: standort.id, datum: a.datum, modus: 'ONLINE' })
    const frei = verf.verfuegbar.find(v => v.loge_id === a.loge_id && v.zeitslot === a.zeitslot)
    if (!frei || frei.max_kinder === null) return konflikt('SLOT_BELEGT', HINWEIS_SLOT_BELEGT)
    if (a.kinder_anzahl > frei.max_kinder) {
      return konflikt('KAPAZITAET', `In dieser Loge sind zu dieser Zeit höchstens ${frei.max_kinder} Kinder möglich.`)
    }

    // 4. Preise ausschließlich serverseitig
    const gesamtbetrag = berechneGesamtbetrag(a.kinder_anzahl, teuer, a.erwachsene_anzahl)
    const anzahlungBetrag = berechneAnzahlung(gesamtbetrag)
    const paketPreisProKind = teuer ? KIND_PREIS_WOCHENENDE : KIND_PREIS_WOCHENTAG

    // 5. Kunde: Bestandskunden werden NIE verändert (Name/E-Mail könnten fremd sein)
    const notizTeile: string[] = []
    if (a.notizen) notizTeile.push(a.notizen)
    let kundeId: string
    const kunde = await findeKunde(standort.id, a.telefon)
    if (kunde) {
      kundeId = kunde.id
      const nameAnders = !gleich(kunde.vorname, a.vorname) || !gleich(kunde.nachname, a.nachname)
      const emailAnders = !gleich(kunde.email, a.email)
      if (nameAnders || emailAnders) notizTeile.push(`Online angegeben: ${a.vorname} ${a.nachname}, ${a.email}`)
    } else {
      const { data: neu, error } = await supabaseAdmin
        .from('kunden')
        .insert({
          standort_id: standort.id,
          vorname: a.vorname,
          nachname: a.nachname,
          telefon: a.telefon,
          email: a.email,
          // Online keine Einwilligung: Verarbeitung zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)
          dsgvo_einwilligung: false,
          // Kein Newsletter-Haken im Widget (nur Hinweis auf das jährliche Angebot) → immer false
          newsletter_opt_in: false,
        })
        .select('id')
        .single()
      if (error || !neu) {
        console.error('[Online-Buchung] Kunde anlegen fehlgeschlagen:', error?.message)
        return fehler(500, 'Die Buchung konnte nicht gespeichert werden. Bitte versucht es erneut.')
      }
      kundeId = neu.id
    }

    // 6. Atomar reservieren (Advisory-Lock in der DB)
    const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc('reserviere_online', {
      p_standort_id: standort.id,
      p_loge_id: a.loge_id,
      p_kunde_id: kundeId,
      p_datum: a.datum,
      p_zeitslot: a.zeitslot,
      p_kinder_anzahl: a.kinder_anzahl,
      p_erwachsene_anzahl: a.erwachsene_anzahl,
      p_paket_preis_pro_kind: paketPreisProKind,
      p_gesamtbetrag: gesamtbetrag,
      p_anzahlung_betrag: anzahlungBetrag,
      p_notizen: notizTeile.length ? notizTeile.join('\n') : null,
      p_idempotenz_schluessel: a.idempotenz_schluessel,
      p_hold_minuten: HOLD_MINUTEN,
    })
    if (rpcErr) {
      console.error('[Online-Buchung] reserviere_online fehlgeschlagen:', rpcErr.message)
      return fehler(500, 'Die Buchung konnte nicht gespeichert werden. Bitte versucht es erneut.')
    }
    const ergebnis = rpc as { id?: string; fehler?: string; hinweis?: string; wiederholt?: boolean }
    if (ergebnis.fehler) {
      const grund: Grund = ergebnis.fehler === 'KAPAZITAET' ? 'KAPAZITAET' : ergebnis.fehler === 'LOGE_UNGUELTIG' ? 'LOGE_UNGUELTIG' : 'SLOT_BELEGT'
      return konflikt(grund, ergebnis.hinweis ?? HINWEIS_SLOT_BELEGT)
    }
    if (ergebnis.wiederholt) {
      // Paralleler Doppelklick: der andere Request hat gewonnen
      const b = await ladeBuchungPerSchluessel(a.idempotenz_schluessel)
      return b ? await antwortFuerBestehendeBuchung(b, a) : konflikt('IN_BEARBEITUNG', 'Eure Buchung wird gerade verarbeitet. Bitte einen Moment warten.')
    }
    const reservierungId = ergebnis.id!

    // 7. Stripe Checkout (30 Min.). Schlägt Stripe fehl → Slot sofort wieder freigeben.
    const { start, ende } = zeitslotZeitraum(a.zeitslot, teuer)
    const datumAnzeige = datumObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    const basis = `${request.nextUrl.origin}/buchen/${standort.slug}`
    let session: { url: string; id: string }
    try {
      session = await erstelleAnzahlungsSession({
        betragCent: Math.round(anzahlungBetrag * 100),
        reservierungId,
        beschreibung: `Anzahlung Geburtstag Upsalla – ${datumAnzeige} (${start}-${ende} Uhr, ${loge.name})`,
        kundenEmail: a.email,
        gueltigkeitSekunden: STRIPE_GUELTIGKEIT_SEKUNDEN,
        successUrl: `${basis}/erfolg?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${basis}/abgebrochen?session_id={CHECKOUT_SESSION_ID}`,
        zusatzMetadata: { quelle: 'ONLINE' },
        // Nur sofort bestätigte Zahlarten (kein SEPA), Hold ist nur 30 Min.
        zahlungsarten: await ermittleSofortZahlarten(),
      })
    } catch (err) {
      console.error('[Online-Buchung] Stripe-Session fehlgeschlagen:', err)
      await supabaseAdmin
        .from('reservierungen')
        .update({ status: 'STORNIERT', aktualisiert_am: new Date().toISOString() })
        .eq('id', reservierungId)
        .eq('angenommen_von', 'ONLINE')
      return fehler(502, 'Die Zahlung konnte gerade nicht gestartet werden. Bitte versucht es in ein paar Minuten erneut.')
    }

    const { error: updErr } = await supabaseAdmin
      .from('reservierungen')
      .update({ stripe_session_id: session.id, stripe_payment_link: session.url })
      .eq('id', reservierungId)
    if (updErr) console.error('[Online-Buchung] Session-ID speichern fehlgeschlagen:', updErr.message)

    return NextResponse.json({ checkout_url: session.url }, { headers: KEIN_CACHE })
  } catch (err) {
    console.error('[Online-Buchung] Unerwarteter Fehler:', err)
    return fehler(500, 'Die Buchung konnte nicht gespeichert werden. Bitte versucht es erneut.')
  }
}
