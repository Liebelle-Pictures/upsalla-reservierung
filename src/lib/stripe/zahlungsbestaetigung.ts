// Zahlungsbestätigung (SMS/E-Mail) für Lena-/Personal-Zahlungen genau EINMAL senden.
//
// Drei Wege können dieselbe Zahlung bestätigen: der Stripe-Webhook (checkout.session.completed,
// Stripe liefert „mindestens einmal“, also ggf. mehrfach), die Seite /zahlung/erfolg (Kunde kommt
// von Stripe zurück) und der Cron stripe-abgleich. Vorher konnte jeder davon senden → doppelte
// SMS/E-Mails. Jetzt „beansprucht“ der erste Weg die Bestätigung atomar über
// reservierungen.bestaetigung_gesendet_am (dieselbe Spalte wie bei Online-Buchungen); alle
// anderen senden nichts. Die Texte der Nachrichten bleiben je Weg unverändert.
//
// Voraussetzung: Migration 013 (alte, schon bezahlte Reservierungen gelten als bestätigt),
// sonst könnte ein verspäteter Webhook/Aufruf für eine alte Zahlung noch einmal senden.
import { supabaseAdmin } from '@/lib/supabase/admin'

// true = DIESER Aufruf darf SMS/E-Mail senden. Nur bei status BESTAETIGT_BEZAHLT und wenn noch
// niemand bestätigt hat. Bei DB-Fehler false (lieber keine zweite Nachricht; der Status ist
// trotzdem korrekt, der Fehler steht im Log).
export async function beansprucheZahlungsbestaetigung(reservierungId: string, weg: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('reservierungen')
    .update({ bestaetigung_gesendet_am: new Date().toISOString() })
    .eq('id', reservierungId)
    .eq('status', 'BESTAETIGT_BEZAHLT')
    .is('bestaetigung_gesendet_am', null)
    .select('id')
  if (error) {
    console.error(`[Zahlungsbestätigung] Beanspruchen fehlgeschlagen (${weg}, ${reservierungId}):`, error.message)
    return false
  }
  const darf = (data ?? []).length > 0
  if (!darf) console.log(`[Zahlungsbestätigung] ${reservierungId} schon bestätigt – ${weg} sendet nichts`)
  return darf
}
