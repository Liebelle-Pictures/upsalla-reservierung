import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeSMS } from '@/lib/twilio/client'
import { erstelleAnzahlungsSession, verfalleSession } from '@/lib/stripe/client'
import { erstelleKurzlink } from '@/lib/utils/kurzlink'

export const dynamic = 'force-dynamic'

// Upsalla-Vorgabe (19.10.2026): Stripe-Checkout-Sessions (mode=payment) sind technisch auf
// maximal 24h begrenzt — das ist kein konfigurierbarer Wert, sondern eine Stripe-Plattform-
// grenze. Ablauf deshalb in 24h-Schritten statt der ursprünglich gewünschten 48h/24h/24h:
//   T+24h: unbezahlt -> frischer Zahlungslink (erneut 24h gültig) + Stornierungs-Warnung
//   T+48h: weiterhin unbezahlt -> automatische Stornierung, Loge/Slot wird wieder frei
// Gilt NUR für von Lena erstellte Geburtstags-/Babywelt-Buchungen (angenommen_von = 'KI LENA')
// — Personal kann weiterhin bewusst ohne Anzahlungsfrist buchen (Upsalla-Wunsch: Mitarbeiter
// am Telefon schätzen oft selbst ein, welche Kunden zuverlässig vor Ort zahlen).
//
// WICHTIG: betrifft nur NEUE Buchungen (zahlungslink_erstellt_am wird erst seit diesem Feature
// gesetzt) — der bestehende Rückstau an alten unbezahlten Reservierungen hat zahlungslink_
// erstellt_am = NULL und wird von diesem Cron nie angefasst, bewusst (siehe Besprechung).
//
// PRÄZISION: Vercel Hobby-Plan erlaubt Cron-Jobs nur einmal täglich (kein stündlicher Lauf
// möglich, Deployment würde sonst fehlschlagen). Die 24h/48h-Fristen werden intern weiterhin
// exakt anhand echter Zeitstempel geprüft (<=, nicht "heute/morgen") — nur der CHECK selbst
// läuft nur 1x/Tag, die Erinnerung/Stornierung kann sich dadurch um bis zu ~24h verzögern,
// nie aber verfrühen. Für exakte Stundenpräzision wäre ein Vercel-Pro-Upgrade nötig.
const ERINNERUNG_NACH_STUNDEN = 24
const STORNO_NACH_STUNDEN = 24 // ... weitere 24h NACH der Erinnerung

function vorStunden(stunden: number): string {
  return new Date(Date.now() - stunden * 60 * 60 * 1000).toISOString()
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }

  let erinnert = 0
  let storniert = 0
  const fehler: string[] = []

  // ── Phase 1: 24h unbezahlt -> Erinnerung mit frischem Link ──────────────────────────
  const { data: faelligErinnerung } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, anzahlung_betrag, kunden(vorname, telefon, email)')
    .eq('status', 'BESTAETIGT_AUSSTEHEND')
    .eq('angenommen_von', 'KI LENA')
    .in('typ', ['GEBURTSTAG', 'BABYWELT_GEBURTSTAG'])
    .is('zahlungserinnerung_gesendet_am', null)
    .not('zahlungslink_erstellt_am', 'is', null)
    .lte('zahlungslink_erstellt_am', vorStunden(ERINNERUNG_NACH_STUNDEN))

  for (const r of faelligErinnerung ?? []) {
    const kundeRaw = r.kunden
    const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string; telefon: string; email: string | null } | null
    if (!kunde?.telefon) continue

    try {
      const datumAnzeige = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      })
      const session = await erstelleAnzahlungsSession({
        betragCent: Math.round(r.anzahlung_betrag * 100),
        reservierungId: r.id,
        beschreibung: `Anzahlung Geburtstag Upsalla – ${datumAnzeige}`,
        kundenEmail: kunde.email ?? undefined,
      })
      const smsLink = await erstelleKurzlink(session.url, r.id).catch(() => session.url)

      await supabaseAdmin
        .from('reservierungen')
        .update({
          stripe_payment_link: session.url,
          stripe_session_id: session.id,
          zahlungslink_erstellt_am: new Date().toISOString(),
          zahlungserinnerung_gesendet_am: new Date().toISOString(),
        })
        .eq('id', r.id)

      await sendeSMS(
        kunde.telefon,
        `Hallo ${kunde.vorname}! Erinnerung: Anzahlung von ${Number(r.anzahlung_betrag).toFixed(2)} Euro für euren Termin am ${datumAnzeige} steht noch aus. Ohne Zahlung binnen 24 Std. wird die Reservierung storniert: ${smsLink}`,
      )
      erinnert++
    } catch (e) {
      fehler.push(`Erinnerung ${r.id}: ${e}`)
      console.error('[Zahlungserinnerung] Fehler bei', r.id, e)
    }
  }

  // ── Phase 2: weitere 24h unbezahlt -> automatische Stornierung ──────────────────────
  const { data: faelligStorno } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, stripe_session_id, kunden(vorname, telefon)')
    .eq('status', 'BESTAETIGT_AUSSTEHEND')
    .eq('angenommen_von', 'KI LENA')
    .in('typ', ['GEBURTSTAG', 'BABYWELT_GEBURTSTAG'])
    .not('zahlungserinnerung_gesendet_am', 'is', null)
    .lte('zahlungserinnerung_gesendet_am', vorStunden(STORNO_NACH_STUNDEN))

  for (const r of faelligStorno ?? []) {
    const kundeRaw = r.kunden
    const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string; telefon: string } | null

    try {
      // Verhindert, dass eine spät eintreffende Zahlung auf dem alten Link noch durchgeht,
      // nachdem die Reservierung storniert und der Slot ggf. anderweitig vergeben wurde.
      if (r.stripe_session_id) await verfalleSession(r.stripe_session_id)

      await supabaseAdmin
        .from('reservierungen')
        .update({ status: 'STORNIERT', aktualisiert_am: new Date().toISOString() })
        .eq('id', r.id)

      if (kunde?.telefon) {
        const datumAnzeige = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
          weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
        })
        await sendeSMS(
          kunde.telefon,
          `Hallo ${kunde.vorname}! Eure Reservierung am ${datumAnzeige} wurde mangels Anzahlung storniert. Bei Interesse gerne erneut anrufen: 0202 2623339`,
        )
      }
      storniert++
    } catch (e) {
      fehler.push(`Storno ${r.id}: ${e}`)
      console.error('[Zahlungserinnerung] Storno-Fehler bei', r.id, e)
    }
  }

  console.log(`[Zahlungserinnerung] ${erinnert} erinnert, ${storniert} storniert`)
  return NextResponse.json({ erinnert, storniert, fehler })
}
