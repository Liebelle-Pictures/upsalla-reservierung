/* E-Mail-Vorlagen für Freizo — Upsalla Kinderpark Wuppertal */

function zeile(label: string, wert: string): string {
  return `
    <tr>
      <td style="padding:8px 0; font-size:13px; color:#6B7280; font-weight:600; width:50%; vertical-align:top;">${label}</td>
      <td style="padding:8px 0; font-size:13px; color:#1E1B4B; font-weight:700; text-align:right; vertical-align:top;">${wert}</td>
    </tr>
    <tr><td colspan="2" style="height:1px; background:#E5E7EB;"></td></tr>
  `
}

function kopfzeile(): string {
  return `
    <tr>
      <td style="background:#1E1B4B; padding:28px 36px;">
        <div style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.02em;">Freizo</div>
        <div style="font-size:11px; color:#A5B4FC; text-transform:uppercase; letter-spacing:0.08em; margin-top:4px;">Upsalla · Wuppertal</div>
      </td>
    </tr>
  `
}

function fusszeile(): string {
  return `
    <tr>
      <td style="padding:20px 36px; border-top:1px solid #E5E7EB;">
        <div style="font-size:12px; color:#9CA3AF; line-height:1.6;">
          Upsalla Kinderpark Wuppertal · Friedrich-Engels-Allee 122–124 · 42285 Wuppertal<br>
          Tel: <a href="tel:020226233390" style="color:#6366F1; text-decoration:none;">0202 2623339</a> ·
          <a href="mailto:info@upsalla-kinderpark.de" style="color:#6366F1; text-decoration:none;">info@upsalla-kinderpark.de</a>
        </div>
        <div style="font-size:11px; color:#D1D5DB; margin-top:8px;">
          Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese Adresse.
        </div>
      </td>
    </tr>
  `
}

function huelle(inhalt: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#F8F7FF; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #E5E7EB; max-width:560px;">
          ${inhalt}
          ${fusszeile()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/* ── Buchungsbestätigung ── */
export interface BuchungsbestaetigungParams {
  vorname: string
  nachname: string
  datum: string         // formatiert z.B. "Samstag, 12.07.2026"
  zeitslot: string      // z.B. "Slot 1 — 10:30–14:30 Uhr"
  logeName: string
  kinderAnzahl: number
  erwachseneAnzahl: number
  gesamtbetrag: number
  anzahlungBetrag: number
  stripePaymentLink: string | null
}

export function buchungsbestaetigungHtml(p: BuchungsbestaetigungParams): string {
  const restbetrag = p.gesamtbetrag - p.anzahlungBetrag

  const zahlungsbox = p.stripePaymentLink
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCE8; border:1.5px solid #FDE047; border-radius:12px; margin-bottom:24px;">
        <tr><td style="padding:20px 24px;">
          <div style="font-size:11px; font-weight:700; color:#A16207; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px;">Anzahlung fällig</div>
          <div style="font-size:24px; font-weight:800; color:#A16207; margin-bottom:14px;">${p.anzahlungBetrag.toFixed(2)} €</div>
          <a href="${p.stripePaymentLink}"
             style="display:inline-block; padding:12px 24px; background:#EAB308; color:#ffffff; font-weight:700; font-size:14px; border-radius:10px; text-decoration:none;">
            Jetzt online bezahlen →
          </a>
          <div style="font-size:12px; color:#A16207; margin-top:10px;">
            Restbetrag ${restbetrag.toFixed(2)} € wird vor Ort kassiert.
          </div>
        </td></tr>
      </table>`
    : `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FFF4; border:1.5px solid #86EFAC; border-radius:12px; margin-bottom:24px;">
        <tr><td style="padding:16px 24px;">
          <div style="font-size:13px; font-weight:700; color:#15803D;">✓ Reservierung bestätigt — Zahlung vor Ort</div>
        </td></tr>
      </table>`

  const inhalt = `
    ${kopfzeile()}
    <tr>
      <td style="padding:32px 36px;">
        <div style="font-size:22px; font-weight:800; color:#1E1B4B; margin-bottom:6px;">Buchungsbestätigung</div>
        <div style="font-size:15px; color:#4B5563; margin-bottom:28px; line-height:1.5;">
          Hallo ${p.vorname},<br>
          Ihre Geburtstagsreservierung bei Upsalla Kinderpark Wuppertal ist bestätigt!
        </div>

        ${zahlungsbox}

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF; border-radius:12px; margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <div style="font-size:11px; font-weight:700; color:#6366F1; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">Reservierungsdetails</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${zeile('Datum', p.datum)}
              ${zeile('Uhrzeit', p.zeitslot)}
              ${zeile('Loge', p.logeName)}
              ${zeile('Kinder', `${p.kinderAnzahl} Kinder`)}
              ${zeile('Erwachsene', `${p.erwachseneAnzahl} Erwachsene`)}
              ${zeile('Gesamtbetrag', `${p.gesamtbetrag.toFixed(2)} €`)}
              ${zeile('Anzahlung', `${p.anzahlungBetrag.toFixed(2)} €`)}
            </table>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF; border:1.5px solid #E5E7EB; border-radius:12px; margin-bottom:24px;">
          <tr><td style="padding:18px 24px;">
            <div style="font-size:11px; font-weight:700; color:#6366F1; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">Stornierungsbedingungen</div>
            <div style="font-size:13px; color:#4B5563; line-height:1.7;">
              ✓ Kostenlose Stornierung bis <strong>7 Tage</strong> vor dem Termin — Anzahlung wird vollständig erstattet.<br>
              ✗ Stornierung unter 7 Tagen — Anzahlung verfällt.<br>
              ✓ Ausnahme: Krankheit des Kindes mit ärztlichem Attest → vollständige Erstattung.
            </div>
            <div style="margin-top:12px;">
              <a href="https://freizo.app/agb"
                 style="display:inline-block; padding:8px 16px; background:#6366F1; color:#fff; font-size:12px; font-weight:700; border-radius:8px; text-decoration:none;">
                Vollständige Bedingungen lesen →
              </a>
            </div>
          </td></tr>
        </table>

        <div style="font-size:13px; color:#6B7280; line-height:1.7;">
          Bei Fragen erreichen Sie uns unter <a href="tel:020226233390" style="color:#6366F1;">0202 2623339</a>
          oder per E-Mail an <a href="mailto:info@upsalla-kinderpark.de" style="color:#6366F1;">info@upsalla-kinderpark.de</a>.
        </div>
      </td>
    </tr>
  `
  return huelle(inhalt)
}

/* ── Stornobestätigung ── */
export interface StornobestaetigungParams {
  vorname: string
  datum: string
  zeitslot: string
  logeName: string
  rueckerstattungBetrag?: number   // > 0 = Rückerstattung wurde ausgelöst
}

export function stornobestaetigungHtml(p: StornobestaetigungParams): string {
  const rueckerstattungsbox = p.rueckerstattungBetrag && p.rueckerstattungBetrag > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FFF4; border:1.5px solid #86EFAC; border-radius:12px; margin-bottom:24px;">
        <tr><td style="padding:20px 24px;">
          <div style="font-size:11px; font-weight:700; color:#15803D; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px;">Rückerstattung</div>
          <div style="font-size:20px; font-weight:800; color:#15803D; margin-bottom:6px;">${p.rueckerstattungBetrag.toFixed(2)} €</div>
          <div style="font-size:13px; color:#166534; line-height:1.6;">
            Die Anzahlung wird innerhalb von 5–10 Werktagen auf Ihr Zahlungsmittel zurückgebucht.
          </div>
        </td></tr>
      </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF3C7; border:1.5px solid #FCD34D; border-radius:12px; margin-bottom:24px;">
        <tr><td style="padding:16px 24px;">
          <div style="font-size:13px; color:#92400E; line-height:1.6;">
            Gemäß unseren Stornierungsbedingungen ist in diesem Fall keine Rückerstattung der Anzahlung möglich.
            Bei Krankheit des Kindes wenden Sie sich bitte mit ärztlichem Attest an uns.
          </div>
        </td></tr>
      </table>`

  const inhalt = `
    ${kopfzeile()}
    <tr>
      <td style="padding:32px 36px;">
        <div style="font-size:22px; font-weight:800; color:#1E1B4B; margin-bottom:6px;">Stornierungsbestätigung</div>
        <div style="font-size:15px; color:#4B5563; margin-bottom:28px; line-height:1.5;">
          Hallo ${p.vorname},<br>
          Ihre Reservierung wurde storniert.
        </div>

        ${rueckerstattungsbox}

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF1F0; border:1.5px solid #FCA5A5; border-radius:12px; margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <div style="font-size:11px; font-weight:700; color:#B91C1C; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">Stornierte Reservierung</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${zeile('Datum', p.datum)}
              ${zeile('Uhrzeit', p.zeitslot)}
              ${zeile('Loge', p.logeName)}
            </table>
          </td></tr>
        </table>

        <div style="font-size:13px; color:#6B7280; line-height:1.7;">
          Möchten Sie einen neuen Termin buchen? Unser Team hilft Ihnen gerne weiter.<br>
          Tel: <a href="tel:020226233390" style="color:#6366F1;">0202 2623339</a> ·
          <a href="mailto:info@upsalla-kinderpark.de" style="color:#6366F1;">info@upsalla-kinderpark.de</a>
        </div>
      </td>
    </tr>
  `
  return huelle(inhalt)
}
