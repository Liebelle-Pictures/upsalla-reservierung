import { NextRequest, NextResponse } from 'next/server'
import { pruefeLenaAuth } from '@/lib/lena/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { istGueltigeTelefonnummer } from '@/lib/utils/telefon'
import { extrahiereAnruferNummer, zuLokalesFormat } from '@/lib/lena/callerPhone'

export const dynamic = 'force-dynamic'

const STAFF_EMAIL = 'upsalla.reservierung@gmail.com'

// POST /api/lena/anfrage — Sonderanfrage/Anliegen speichern, das Lena nicht selbst lösen
// konnte (z.B. Sonderwunsch, Beschwerde, Frage außerhalb des Wissens). Vorher sagte Lena nur
// "ich notiere das für das Team" ohne dass irgendwo tatsächlich etwas ankam.
export async function POST(request: NextRequest) {
  const auth = pruefeLenaAuth(request)
  if (auth) return auth

  const body = await request.json().catch(() => ({}))
  const args = body.args ?? body
  const { vorname, nachname, anliegen, reservierung_id } = args as {
    vorname?: string
    nachname?: string
    telefon?: string
    anliegen: string
    reservierung_id?: string
  }
  let telefon = (args as { telefon?: string }).telefon

  if (!anliegen) {
    return NextResponse.json({ hinweis: 'Anliegen fehlt. Bitte kurz zusammenfassen, worum es geht.' })
  }

  // Fallback: das LLM übergibt telefon manchmal als Platzhalter/gar nicht, obwohl die echte
  // Anrufer-Nummer verfügbar ist (siehe callerPhone.ts) — server-seitig nachrüsten statt dem
  // Kunden fälschlich zu sagen, das Team könne ihn nicht zurückrufen.
  if (!telefon || !istGueltigeTelefonnummer(telefon)) {
    const anruferNummer = extrahiereAnruferNummer(body)
    if (anruferNummer) telefon = zuLokalesFormat(anruferNummer)
  }

  if (!telefon) {
    return NextResponse.json({ hinweis: 'Telefonnummer fehlt — ohne sie kann das Team den Kunden nicht zurückrufen. Bitte den Kunden nach seiner Telefonnummer fragen und dann erneut aufrufen.' })
  }

  const { data: eintrag, error } = await supabaseAdmin
    .from('kunden_anfragen')
    .insert({
      vorname: vorname ?? null,
      nachname: nachname ?? null,
      telefon: telefon ?? null,
      anliegen,
      reservierung_id: reservierung_id ?? null,
    })
    .select('id')
    .single()

  if (error || !eintrag) {
    console.error('[Lena Anfrage] DB-Fehler:', error?.message)
    return NextResponse.json({ fehler: 'Anfrage konnte nicht gespeichert werden' }, { status: 500 })
  }

  try {
    const { sendeEmail } = await import('@/lib/resend/client')
    await sendeEmail({
      an: STAFF_EMAIL,
      betreff: `Neue Anfrage von Lena${vorname ? ` — ${vorname}${nachname ? ` ${nachname}` : ''}` : ''}`,
      html: `
        <p><strong>Neue Kundenanfrage über Lena:</strong></p>
        <p>${anliegen.replace(/\n/g, '<br>')}</p>
        <p>
          Name: ${vorname ?? '—'} ${nachname ?? ''}<br>
          Telefon: ${telefon ?? '—'}
        </p>
        <p>Zu sehen unter freizo.app/anfragen</p>
      `,
    })
  } catch (err) {
    console.error('[Lena Anfrage] E-Mail-Benachrichtigung fehlgeschlagen:', err)
    // Blockiert nicht — die Anfrage ist bereits gespeichert und im Dashboard sichtbar
  }

  return NextResponse.json({ erfolg: true, hinweis: 'Anfrage wurde an das Team weitergeleitet.' })
}
