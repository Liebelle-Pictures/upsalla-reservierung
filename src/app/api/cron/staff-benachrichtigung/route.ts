import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendeEmail } from '@/lib/resend/client'

export const dynamic = 'force-dynamic'

const STAFF_EMAIL = 'upsalla.reservierung@gmail.com'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Unauthorized' }, { status: 401 })
  }

  // Reservierungen die vor mehr als 72h erstellt wurden und noch nicht bezahlt sind
  const vor72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const { data: reservierungen, error } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, gesamtbetrag, anzahlung_betrag, erstellt_am, kunden(vorname, nachname, telefon), logen(name)')
    .eq('status', 'BESTAETIGT_AUSSTEHEND')
    .lt('erstellt_am', vor72h)

  if (error) {
    console.error('[Staff-Benachrichtigung] DB-Fehler:', error)
    return NextResponse.json({ fehler: 'Datenbankfehler' }, { status: 500 })
  }

  if (!reservierungen || reservierungen.length === 0) {
    console.log('[Staff-Benachrichtigung] Keine offenen Anzahlungen nach 72h')
    return NextResponse.json({ gesendet: 0, hinweis: 'Keine offenen Anzahlungen' })
  }

  // E-Mail mit allen offenen Reservierungen zusammenstellen
  const zeilen = reservierungen.map(r => {
    const kundeRaw = r.kunden
    const kunde = (Array.isArray(kundeRaw) ? kundeRaw[0] : kundeRaw) as { vorname: string; nachname: string; telefon: string } | null
    const logeRaw = r.logen
    const loge = (Array.isArray(logeRaw) ? logeRaw[0] : logeRaw) as { name: string } | null

    const datumAnzeige = new Date(r.datum + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const zeitAnzeige = r.zeitslot === 1 ? '10:30–14:30' : '15:00–19:00'
    const restbetrag = (Number(r.gesamtbetrag) - Number(r.anzahlung_betrag)).toFixed(2)
    const erstelltAm = new Date(r.erstellt_am).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    return `
      <tr style="border-bottom:1px solid #E2E8F0;">
        <td style="padding:10px 12px;font-weight:700;color:#1E1B4B;">${kunde ? `${kunde.vorname} ${kunde.nachname}` : '—'}</td>
        <td style="padding:10px 12px;color:#475569;">${kunde?.telefon ?? '—'}</td>
        <td style="padding:10px 12px;color:#475569;">${loge?.name ?? '—'}</td>
        <td style="padding:10px 12px;color:#475569;">${datumAnzeige}<br><span style="font-size:0.8rem;">${zeitAnzeige}</span></td>
        <td style="padding:10px 12px;font-weight:700;color:#DC2626;">${restbetrag} €</td>
        <td style="padding:10px 12px;font-size:0.8rem;color:#94A3B8;">${erstelltAm}</td>
      </tr>`
  }).join('')

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;background:#F8FAFC;margin:0;padding:24px;">
      <div style="max-width:700px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <div style="background:#1E1B4B;padding:24px 32px;">
          <div style="color:#fff;font-size:1.3rem;font-weight:800;letter-spacing:-0.01em;">Upsalla Kinderpark Wuppertal</div>
          <div style="color:#A5B4FC;font-size:0.9rem;margin-top:4px;">Offene Anzahlungen — Erinnerung für das Team</div>
        </div>

        <div style="padding:24px 32px;">
          <p style="color:#475569;margin:0 0 16px;">
            Die folgenden Reservierungen sind seit mehr als <strong>72 Stunden</strong> ohne Anzahlung.
            Bitte nehmt Kontakt mit den Kunden auf.
          </p>

          <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
            <thead>
              <tr style="background:#F1F5F9;border-bottom:2px solid #E2E8F0;">
                <th style="padding:10px 12px;text-align:left;color:#64748B;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Name</th>
                <th style="padding:10px 12px;text-align:left;color:#64748B;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Telefon</th>
                <th style="padding:10px 12px;text-align:left;color:#64748B;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Loge</th>
                <th style="padding:10px 12px;text-align:left;color:#64748B;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Termin</th>
                <th style="padding:10px 12px;text-align:left;color:#64748B;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Offen</th>
                <th style="padding:10px 12px;text-align:left;color:#64748B;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Erstellt</th>
              </tr>
            </thead>
            <tbody>${zeilen}</tbody>
          </table>

          <div style="margin-top:24px;padding:16px;background:#FEF2F2;border-radius:10px;border-left:4px solid #EF4444;">
            <p style="margin:0;color:#991B1B;font-size:0.88rem;">
              <strong>${reservierungen.length} Reservierung${reservierungen.length !== 1 ? 'en' : ''}</strong>
              mit offener Anzahlung. Bei Nichtreaktion bitte Reservierung stornieren.
            </p>
          </div>

          <div style="margin-top:16px;text-align:center;">
            <a href="https://freizo.app/reservierungen"
               style="display:inline-block;background:#6366F1;color:#fff;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;font-size:0.9rem;">
              Freizo öffnen →
            </a>
          </div>
        </div>

        <div style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
          <p style="margin:0;font-size:0.78rem;color:#94A3B8;text-align:center;">
            Automatische Nachricht · Upsalla Kinderpark Wuppertal · 0202 2623339
          </p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    await sendeEmail({
      an: STAFF_EMAIL,
      betreff: `⚠️ ${reservierungen.length} offene Anzahlung${reservierungen.length !== 1 ? 'en' : ''} nach 72h — Upsalla`,
      html,
    })
    console.log(`[Staff-Benachrichtigung] E-Mail gesendet: ${reservierungen.length} offene Reservierungen`)
    return NextResponse.json({ gesendet: 1, offene: reservierungen.length })
  } catch (e) {
    console.error('[Staff-Benachrichtigung] E-Mail-Fehler:', e)
    return NextResponse.json({ fehler: 'E-Mail konnte nicht gesendet werden' }, { status: 500 })
  }
}
