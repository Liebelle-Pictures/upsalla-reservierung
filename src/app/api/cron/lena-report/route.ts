import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Anrufe unter dieser Dauer haben laut Stichprobenanalyse (21.09.2026) praktisch nie echten
// Gesprächsinhalt — reines Auflegen/Verwählen, bevor ein Wort gewechselt wird. Werden als eigene
// Kategorie ausgewiesen statt in "Kein Abschluss" versteckt, damit (a) die Gesamtzahl weiterhin
// mit der Anrufminuten-Abrechnung übereinstimmt und (b) die Abschlussquote nicht künstlich durch
// Anrufe gedrückt wird, bei denen nie eine Buchungsabsicht bestand.
const KURZANRUF_SCHWELLE_SEKUNDEN = 10

function formatDauer(sek: number | null): string {
  if (!sek) return '–'
  const m = Math.floor(sek / 60)
  const s = sek % 60
  return m > 0 ? `${m} Min. ${s} Sek.` : `${s} Sek.`
}

function formatDatum(datum: string): string {
  return new Date(datum + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  })
}

function lenaWochenreportHtml(params: {
  vonDatum: string
  bisDatum: string
  gesamt: number
  reserviert: number
  nichtReserviert: number
  voicemail: number
  kurzanrufe: number
  fehlgeschlagenListe: Array<{ datum: string; dauer: number | null; zusammenfassung: string | null }>
}): string {
  const { vonDatum, bisDatum, gesamt, reserviert, nichtReserviert, voicemail, kurzanrufe, fehlgeschlagenListe } = params
  // Abschlussquote nur auf Basis echter Gespräche (ohne Mailbox, ohne Kurzanrufe unter 10 Sek.
  // ohne Gesprächsinhalt) — sonst verzerren reine Verwähler/Auflege-Anrufe die Quote nach unten,
  // obwohl dort nie eine Buchungsabsicht bestand. "Gesamt" bleibt trotzdem die echte Gesamtzahl
  // aller Anrufe (Reserviert + Kein Abschluss + Kurzanrufe + Mailbox = Gesamt), damit die Zahlen
  // weiterhin mit der Telefonrechnung/Anrufminuten übereinstimmen — nichts wird versteckt, nur
  // sauber aufgeteilt.
  const relevanteAnrufe = gesamt - voicemail - kurzanrufe
  const quote = relevanteAnrufe > 0 ? Math.round((reserviert / relevanteAnrufe) * 100) : 0

  const fehlschlagZeilen = fehlgeschlagenListe.length === 0
    ? '<tr><td colspan="3" style="padding:12px; text-align:center; color:#9CA3AF; font-size:13px;">Keine nicht abgeschlossenen Gespräche mit echtem Inhalt diese Woche.</td></tr>'
    : fehlgeschlagenListe.map(a => `
        <tr>
          <td style="padding:10px 12px; font-size:13px; color:#374151; border-bottom:1px solid #F3F4F6;">${formatDatum(a.datum)}</td>
          <td style="padding:10px 12px; font-size:13px; color:#6B7280; border-bottom:1px solid #F3F4F6;">${formatDauer(a.dauer)}</td>
          <td style="padding:10px 12px; font-size:13px; color:#374151; border-bottom:1px solid #F3F4F6;">${a.zusammenfassung ?? '–'}</td>
        </tr>
      `).join('')

  return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">

    <!-- Kopfzeile -->
    <tr>
      <td style="background:#1E1B4B;padding:28px 36px;">
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Freizo</div>
        <div style="font-size:11px;color:#A5B4FC;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Lena · Wochenbericht</div>
      </td>
    </tr>

    <!-- Zeitraum -->
    <tr>
      <td style="padding:24px 36px 0;">
        <div style="font-size:15px;font-weight:700;color:#1E1B4B;">
          Woche ${vonDatum} – ${bisDatum}
        </div>
      </td>
    </tr>

    <!-- Statistik-Karten -->
    <tr>
      <td style="padding:20px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="32%" style="text-align:center;padding:16px 8px;background:#F3F4F6;border-radius:12px;">
              <div style="font-size:28px;font-weight:800;color:#1E1B4B;">${gesamt}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;">Gesamt</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="text-align:center;padding:16px 8px;background:#ECFDF5;border-radius:12px;">
              <div style="font-size:28px;font-weight:800;color:#065F46;">${reserviert}</div>
              <div style="font-size:11px;color:#059669;margin-top:4px;">Reserviert</div>
            </td>
            <td width="2%"></td>
            <td width="32%" style="text-align:center;padding:16px 8px;background:#FEF2F2;border-radius:12px;">
              <div style="font-size:28px;font-weight:800;color:#991B1B;">${nichtReserviert}</div>
              <div style="font-size:11px;color:#DC2626;margin-top:4px;">Kein Abschluss</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
          <tr>
            <td width="49%" style="text-align:center;padding:14px 8px;background:#F4F4F5;border-radius:12px;">
              <div style="font-size:22px;font-weight:800;color:#52525B;">${kurzanrufe}</div>
              <div style="font-size:11px;color:#71717A;margin-top:4px;">Kurzanrufe &lt;10 Sek. (kein Gespräch)</div>
            </td>
            <td width="2%"></td>
            <td width="49%" style="text-align:center;padding:14px 8px;background:#FFFBEB;border-radius:12px;">
              <div style="font-size:22px;font-weight:800;color:#92400E;">${voicemail}</div>
              <div style="font-size:11px;color:#D97706;margin-top:4px;">Mailbox</div>
            </td>
          </tr>
        </table>

        <!-- Abschlussquote -->
        <div style="margin-top:16px;background:#EEF2FF;border-radius:10px;padding:14px 16px;">
          <span style="font-size:13px;color:#4338CA;font-weight:600;">Abschlussquote: <strong>${quote}%</strong></span>
          <div style="font-size:11px;color:#6366F1;margin-top:4px;line-height:1.5;">
            Bezogen auf ${relevanteAnrufe} Anrufe mit echtem Gespräch (ohne Mailbox und ohne Kurzanrufe unter 10 Sekunden ohne Gesprächsinhalt — diese zählen weiterhin zur Gesamtzahl oben, damit sie mit der Anrufminuten-Abrechnung übereinstimmt, fließen aber nicht in die Quote ein).
          </div>
        </div>
      </td>
    </tr>

    <!-- Nicht abgeschlossene Gespräche -->
    <tr>
      <td style="padding:0 36px 24px;">
        <div style="font-size:14px;font-weight:700;color:#1E1B4B;margin-bottom:2px;">Nicht abgeschlossene Gespräche</div>
        <div style="font-size:11px;color:#9CA3AF;margin-bottom:12px;">Nur Anrufe mit echtem Gesprächsinhalt (10 Sek. oder länger) — Kurzanrufe siehe Statistik oben.</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
          <tr style="background:#F9FAFB;">
            <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Datum</th>
            <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Dauer</th>
            <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Zusammenfassung</th>
          </tr>
          ${fehlschlagZeilen}
        </table>
      </td>
    </tr>

    <!-- Fußzeile -->
    <tr>
      <td style="padding:20px 36px;border-top:1px solid #E5E7EB;">
        <div style="font-size:12px;color:#9CA3AF;line-height:1.6;">
          Upsalla Kinderpark Wuppertal · Porschestraße 22 · 42279 Wuppertal<br>
          Automatisch generiert von Freizo — jeden Montag 08:00 Uhr
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ fehler: 'Nicht autorisiert' }, { status: 401 })
  }

  // Letzten 7 Tage
  const bis = new Date()
  const von = new Date()
  von.setDate(von.getDate() - 7)
  const vonStr = von.toISOString().slice(0, 10)
  const bisStr = bis.toISOString().slice(0, 10)

  const { data: anrufe } = await supabaseAdmin
    .from('lena_anrufe')
    .select('datum, dauer_sekunden, reservierung_erstellt, in_voicemail, zusammenfassung')
    .gte('datum', vonStr)
    .lte('datum', bisStr)
    .order('datum', { ascending: false })

  const liste = anrufe ?? []
  const gesamt = liste.length
  const voicemail = liste.filter(a => a.in_voicemail).length
  const reserviert = liste.filter(a => a.reservierung_erstellt).length
  // Kurzanrufe: weder Buchung noch Mailbox, UND unter der Kurzanruf-Schwelle — eigene Kategorie,
  // siehe Kommentar bei KURZANRUF_SCHWELLE_SEKUNDEN oben.
  const kurzanrufe = liste.filter(a =>
    !a.reservierung_erstellt && !a.in_voicemail && (a.dauer_sekunden ?? 0) < KURZANRUF_SCHWELLE_SEKUNDEN,
  ).length
  // "Kein Abschluss" zeigt nur noch echte Gespräche ohne Buchung — Gesamt bleibt exakt
  // reserviert + voicemail + kurzanrufe + nichtReserviert, nichts geht verloren.
  const nichtReserviert = gesamt - reserviert - voicemail - kurzanrufe

  const fehlgeschlagenListe = liste
    .filter(a => !a.reservierung_erstellt && !a.in_voicemail && (a.dauer_sekunden ?? 0) >= KURZANRUF_SCHWELLE_SEKUNDEN)
    .map(a => ({ datum: a.datum, dauer: a.dauer_sekunden, zusammenfassung: a.zusammenfassung }))

  const html = lenaWochenreportHtml({
    vonDatum: new Date(vonStr + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    bisDatum: new Date(bisStr + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    gesamt,
    reserviert,
    nichtReserviert,
    voicemail,
    kurzanrufe,
    fehlgeschlagenListe,
  })

  const { sendeEmail } = await import('@/lib/resend/client')

  const betreff = `Lena Wochenbericht ${new Date(vonStr + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}–${new Date(bisStr + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`

  await Promise.all([
    sendeEmail({ an: 'info@upsalla-kinderpark.de', betreff, html }),
    sendeEmail({ an: 'info@smartcallservice.de', betreff, html }),
  ])

  return NextResponse.json({ gesendet: true, gesamt, reserviert, nichtReserviert, voicemail, kurzanrufe })
}
