import { randomInt } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Ohne verwechselbare Zeichen (0/O, 1/I/l)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const CODE_LAENGE = 7
const GUELTIGKEIT_TAGE = 90 // deckt sich grob mit der Lebensdauer der Stripe-Checkout-Session

function zufallsCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LAENGE; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

// Erstellt einen kurzen freizo.app/p/{code}-Link, der auf zielUrl weiterleitet.
// Genutzt für Stripe-Zahlungslinks in SMS — der rohe Checkout-Link ist so lang, dass
// er 3 SMS-Segmente statt 1 braucht (3x Kosten pro SMS).
export async function erstelleKurzlink(zielUrl: string, reservierungId?: string): Promise<string> {
  const laeuftAbAm = new Date(Date.now() + GUELTIGKEIT_TAGE * 24 * 60 * 60 * 1000).toISOString()

  for (let versuch = 0; versuch < 5; versuch++) {
    const code = zufallsCode()
    const { error } = await supabaseAdmin
      .from('sms_kurzlinks')
      .insert({ code, ziel_url: zielUrl, reservierung_id: reservierungId ?? null, laeuft_ab_am: laeuftAbAm })

    if (!error) return `https://freizo.app/p/${code}`
    if (error.code !== '23505') throw error // nur bei Code-Kollision erneut versuchen
  }

  throw new Error('Konnte keinen eindeutigen Kurzlink-Code erzeugen')
}
