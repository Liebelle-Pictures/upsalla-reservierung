// Zahlungseingang + Bestätigung für Online-Buchungen (angenommen_von = 'ONLINE').
// Aufgerufen vom Stripe-Webhook, der Erfolgsseite /buchen/[standort]/erfolg und dem
// Cron stripe-abgleich. Alle Schritte sind idempotent — egal wer zuerst kommt, der Kunde
// bekommt SMS und E-Mail genau einmal. Lena/Personal nutzen diese Datei NICHT.
// Siehe docs/module/online-buchung.md, 5.4 und 5.5.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { zeitslotZeitraum } from '@/lib/utils/zeitslots'

// Empfänger der Staff-Benachrichtigung. Fehlt die Variable, wird nichts gesendet
// (lokal: eigene Adresse, Produktion: upsalla.reservierung@gmail.com).
export function staffNotificareEmail(): string | null {
  const wert = process.env.STAFF_NOTIFICARE_EMAIL?.trim()
  return wert ? wert : null
}

// Exakt derselbe Text wie die Zahlungsbestätigungs-SMS im Stripe-Webhook (Lena-Weg).
// Nur GSM-7: Bindestrich statt Gedankenstrich. Test: scripts/test-stripe-lena-unveraendert.ts
// Mit „ganzer Loge“ (nur online) ein kurzer Zusatz, ebenfalls GSM-7 (ü ist im GSM-7-Zeichensatz).
export const SMS_ZUSATZ_GANZE_LOGE = ' Ganze Loge für euch.'
export function zahlungsbestaetigungSmsText(p: { vorname: string; datumAnzeige: string; start: string; ende: string; restbetrag: string; ganzeLoge?: boolean }): string {
  return `Hallo ${p.vorname}! Eure Anzahlung ist eingegangen - der Termin am ${p.datumAnzeige} (${p.start}-${p.ende} Uhr) ist fix!${p.ganzeLoge ? SMS_ZUSATZ_GANZE_LOGE : ''} Restbetrag von ${p.restbetrag} € bitte am Tag der Feier vor Ort bezahlen. Bis bald!`
}

// Anzeige der Loge in E-Mails/Kalender: „Anna & Elsa (ganze Loge)“
export function logeAnzeige(name: string, ganzeLoge: boolean): string {
  return ganzeLoge ? `${name} (ganze Loge)` : name
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export type ZahlungsErgebnis =
  | 'BEZAHLT_GESETZT'         // dieser Aufruf hat den Status auf BESTAETIGT_BEZAHLT gesetzt
  | 'BEREITS_BEZAHLT'         // war schon bezahlt (anderer Aufruf war schneller)
  | 'KEINE_ONLINE_BUCHUNG'    // Reservierung fehlt oder ist keine Online-Buchung
  | 'FEHLER'

// Setzt eine Online-Buchung auf BESTAETIGT_BEZAHLT. War der Slot zum Zahlungszeitpunkt schon
// wieder freigegeben (storniert oder Hold abgelaufen), bleibt die Buchung trotzdem bezahlt,
// aber das Team bekommt einen Eintrag in kunden_anfragen zum Prüfen (Slot evtl. doppelt belegt).
// zahlungszeit: wann Stripe die Zahlung bestätigt hat (unbekannt → nur Storno-Prüfung).
export async function markiereOnlineBuchungBezahlt(
  reservierungId: string,
  paymentIntentId: string | null,
  zahlungszeit?: Date,
): Promise<ZahlungsErgebnis> {
  const { data: res, error } = await supabaseAdmin
    .from('reservierungen')
    .select('id, status, angenommen_von, online_hold_bis, kunden(vorname, nachname, telefon)')
    .eq('id', reservierungId)
    .maybeSingle()
  if (error) {
    console.error('[Online-Buchung] Reservierung laden fehlgeschlagen:', error.message)
    return 'FEHLER'
  }
  if (!res || res.angenommen_von !== 'ONLINE') return 'KEINE_ONLINE_BUCHUNG'
  if (res.status === 'BESTAETIGT_BEZAHLT') return 'BEREITS_BEZAHLT'

  const warStorniert = res.status === 'STORNIERT'
  const holdAbgelaufen = !!zahlungszeit && !!res.online_hold_bis && new Date(res.online_hold_bis) < zahlungszeit

  // Nur der Aufruf, der den Status tatsächlich ändert, bekommt eine Zeile zurück → genau ein
  // kunden_anfragen-Eintrag, auch wenn Webhook und Erfolgsseite gleichzeitig laufen.
  const { data: geaendert, error: updErr } = await supabaseAdmin
    .from('reservierungen')
    .update({
      status: 'BESTAETIGT_BEZAHLT',
      stripe_payment_intent_id: paymentIntentId,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq('id', reservierungId)
    .eq('angenommen_von', 'ONLINE')
    .neq('status', 'BESTAETIGT_BEZAHLT')
    .select('id')
  if (updErr) {
    console.error('[Online-Buchung] Status BEZAHLT setzen fehlgeschlagen:', updErr.message)
    return 'FEHLER'
  }
  if (!geaendert || geaendert.length === 0) return 'BEREITS_BEZAHLT'

  if (warStorniert || holdAbgelaufen) {
    const kunde = (Array.isArray(res.kunden) ? res.kunden[0] : res.kunden) as { vorname: string; nachname: string; telefon: string | null } | null
    const { error: anfErr } = await supabaseAdmin.from('kunden_anfragen').insert({
      vorname: kunde?.vorname ?? null,
      nachname: kunde?.nachname ?? null,
      telefon: kunde?.telefon ?? null,
      anliegen: `Online-Buchung bezahlt, Slot evtl. doppelt belegt - bitte prüfen (${warStorniert ? 'war bereits storniert' : 'Reservierungszeit war abgelaufen'}).`,
      reservierung_id: reservierungId,
    })
    if (anfErr) console.error('[Online-Buchung] kunden_anfragen-Eintrag fehlgeschlagen:', anfErr.message)
    console.error(`[Online-Buchung] ${reservierungId} bezahlt, obwohl Slot schon freigegeben war - zur Prüfung markiert`)
  }
  return 'BEZAHLT_GESETZT'
}

// Schickt SMS + E-Mail (mit ICS) an den Kunden und optional die Staff-Benachrichtigung —
// genau einmal pro Reservierung (bestaetigung_gesendet_am). Gibt true zurück, wenn DIESER
// Aufruf gesendet hat. emailAusStripe: E-Mail aus dem Checkout (customer_details.email).
export async function bestaetigeOnlineBuchung(reservierungId: string, emailAusStripe?: string | null): Promise<boolean> {
  // Atomar "beanspruchen": nur eine Zeile, wenn noch nie bestätigt wurde
  const { data: beansprucht, error } = await supabaseAdmin
    .from('reservierungen')
    .update({ bestaetigung_gesendet_am: new Date().toISOString() })
    .eq('id', reservierungId)
    .eq('angenommen_von', 'ONLINE')
    .eq('status', 'BESTAETIGT_BEZAHLT')
    .is('bestaetigung_gesendet_am', null)
    .select('id, datum, zeitslot, kinder_anzahl, erwachsene_anzahl, gesamtbetrag, anzahlung_betrag, notizen, ganze_loge, kunden(vorname, nachname, telefon, email), logen(name)')
  if (error) {
    console.error('[Online-Buchung] Bestätigung beanspruchen fehlgeschlagen:', error.message)
    return false
  }
  const res = beansprucht?.[0]
  if (!res) return false

  const kunde = (Array.isArray(res.kunden) ? res.kunden[0] : res.kunden) as { vorname: string; nachname: string; telefon: string | null; email: string | null } | null
  const loge = (Array.isArray(res.logen) ? res.logen[0] : res.logen) as { name: string } | null
  const ganzeLoge = res.ganze_loge === true
  const logeName = logeAnzeige(loge?.name ?? 'Loge', ganzeLoge)
  const datumAnzeige = new Date(res.datum + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const weekend = await istPreisteuerterTag(new Date(res.datum + 'T00:00:00'))
  const { start, ende } = zeitslotZeitraum(res.zeitslot, weekend)
  const restbetrag = (Number(res.gesamtbetrag) - Number(res.anzahlung_betrag)).toFixed(2)
  const kundenEmail = emailAusStripe ?? kunde?.email ?? null

  if (kunde?.telefon) {
    try {
      const { sendeSMS } = await import('@/lib/twilio/client')
      await sendeSMS(kunde.telefon, zahlungsbestaetigungSmsText({ vorname: kunde.vorname, datumAnzeige, start, ende, restbetrag, ganzeLoge }))
    } catch (err) {
      console.error('[Online-Buchung] Bestätigungs-SMS fehlgeschlagen:', err)
    }
  }

  if (kundenEmail && kunde) {
    try {
      const { sendeEmail } = await import('@/lib/resend/client')
      const { buchungsbestaetigungHtml } = await import('@/lib/resend/templates')
      const { erzeugeReservierungICS } = await import('@/lib/utils/ics')
      await sendeEmail({
        an: kundenEmail,
        betreff: `Buchungsbestätigung – ${datumAnzeige} · Upsalla Kinderpark Wuppertal`,
        html: buchungsbestaetigungHtml({
          vorname: kunde.vorname,
          nachname: kunde.nachname,
          datum: datumAnzeige,
          zeitslot: `Slot ${res.zeitslot} — ${start}–${ende} Uhr`,
          logeName,
          kinderAnzahl: res.kinder_anzahl,
          erwachseneAnzahl: res.erwachsene_anzahl,
          gesamtbetrag: Number(res.gesamtbetrag),
          anzahlungBetrag: Number(res.anzahlung_betrag),
          stripePaymentLink: null, // bezahlt → grüne "bestätigt"-Box
        }),
        kalenderAnhang: {
          dateiname: 'termin.ics',
          inhalt: erzeugeReservierungICS({ reservierungId, datum: res.datum, startZeit: start, endZeit: ende, logeName, vorname: kunde.vorname }),
          methode: 'REQUEST',
        },
      })
    } catch (err) {
      console.error('[Online-Buchung] Bestätigungs-E-Mail fehlgeschlagen:', err)
    }
  }

  const staffEmail = staffNotificareEmail()
  if (staffEmail) {
    try {
      const { sendeEmail } = await import('@/lib/resend/client')
      const zeile = (k: string, v: string) => `<tr><td style="padding:6px 12px;color:#64748b;">${k}</td><td style="padding:6px 12px;color:#0f172a;font-weight:600;">${escapeHtml(v)}</td></tr>`
      await sendeEmail({
        an: staffEmail,
        betreff: `Neue Online-Buchung – ${datumAnzeige} · ${logeName}`,
        html: `<div style="font-family:system-ui,sans-serif;"><h2 style="color:#15803d;">Neue Online-Buchung (Anzahlung bezahlt)</h2><table style="border-collapse:collapse;">${[
          zeile('Datum', datumAnzeige),
          zeile('Uhrzeit', `Slot ${res.zeitslot}, ${start}-${ende} Uhr`),
          zeile('Loge', logeName),
          zeile('Kinder / Erwachsene', `${res.kinder_anzahl} / ${res.erwachsene_anzahl}`),
          ...(ganzeLoge ? [zeile('Ganze Loge', `Ja – exklusiv, berechnet für mindestens 10 Kinder`)] : []),
          zeile('Kunde', `${kunde?.vorname ?? ''} ${kunde?.nachname ?? ''}`.trim()),
          zeile('Telefon', kunde?.telefon ?? '-'),
          zeile('E-Mail', kundenEmail ?? '-'),
          zeile('Gesamt / Anzahlung', `${Number(res.gesamtbetrag).toFixed(2)} € / ${Number(res.anzahlung_betrag).toFixed(2)} €`),
          zeile('Notizen', res.notizen ?? '-'),
        ].join('')}</table><p>Details in Freizo: freizo.app/reservierungen</p></div>`,
      })
    } catch (err) {
      console.error('[Online-Buchung] Staff-Benachrichtigung fehlgeschlagen:', err)
    }
  }

  return true
}

// Gibt eine unbezahlte Online-Buchung frei (Session abgelaufen oder Zahlung abgebrochen).
// Greift nur, wenn sie noch zur angegebenen Stripe-Session gehört — eine Lena-/Personal-
// Reservierung wird hier nie verändert. Gibt true zurück, wenn storniert wurde.
export async function storniereUnbezahlteOnlineBuchung(reservierungId: string, stripeSessionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('reservierungen')
    .update({ status: 'STORNIERT', aktualisiert_am: new Date().toISOString() })
    .eq('id', reservierungId)
    .eq('angenommen_von', 'ONLINE')
    .eq('status', 'BESTAETIGT_AUSSTEHEND')
    .eq('stripe_session_id', stripeSessionId)
    .select('id')
  if (error) {
    console.error('[Online-Buchung] Freigabe fehlgeschlagen:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
