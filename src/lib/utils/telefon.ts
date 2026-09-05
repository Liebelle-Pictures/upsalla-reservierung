// Grobe Plausibilitätsprüfung — keine echte Telefonnummer-Validierung, sondern ein
// Sicherheitsnetz gegen offensichtlich falsche Werte (z.B. wenn Lena versehentlich einen
// Namen statt einer Nummer übergibt).
export function istGueltigeTelefonnummer(nummer: string): boolean {
  const bereinigt = nummer.trim().replace(/[\s()-]/g, '')
  return /^\+?\d{6,15}$/.test(bereinigt)
}

// Lokales Format (0...) nach E.164 (+49...) für Twilio. Bei einer echten Twilio-Rufnummer
// als Absender toleriert Twilio auch lokale Nummern im "To"-Feld — bei einer alphanumerischen
// Sender-ID (z.B. "Upsalla") NICHT mehr, dann wird strikt E.164 verlangt (sonst Fehler 21211).
export function zuE164(nummer: string): string {
  const bereinigt = nummer.trim().replace(/[\s()-]/g, '')
  if (bereinigt.startsWith('+')) return bereinigt
  if (bereinigt.startsWith('0')) return `+49${bereinigt.slice(1)}`
  return bereinigt
}
