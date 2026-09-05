// Generiert einen Kalendereintrag (.ics) für eine Reservierung — als E-Mail-Anhang, damit
// Gmail/Outlook/Apple Mail automatisch einen "Zum Kalender hinzufügen"-Button anzeigen.

function berlinZuUTC(datum: string, uhrzeit: string): Date {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  const [stunde, minute] = uhrzeit.split(':').map(Number)
  // Grobe UTC-Instanz nur um die DST-Verschiebung für dieses Kalenderdatum zu ermitteln
  const grob = new Date(Date.UTC(jahr, monat - 1, tag, stunde, minute))
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'shortOffset',
  }).formatToParts(grob)
  const offsetText = teile.find(t => t.type === 'timeZoneName')?.value ?? 'GMT+1'
  const offsetStunden = offsetText.includes('+2') ? 2 : 1
  return new Date(Date.UTC(jahr, monat - 1, tag, stunde - offsetStunden, minute))
}

function formatICSUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function escapeICSText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

const ADRESSE = 'Upsalla Kinderpark Wuppertal, Friedrich-Engels-Allee 122–124, 42285 Wuppertal'
const UID_DOMAIN = 'upsalla-kinderpark.de'

export interface ReservierungICSParams {
  reservierungId: string
  datum: string       // 'YYYY-MM-DD'
  startZeit: string   // 'HH:MM'
  endZeit: string     // 'HH:MM'
  logeName: string
  vorname: string
}

// storniert=false → METHOD:REQUEST, STATUS:CONFIRMED (neuer/bestätigter Termin)
// storniert=true  → METHOD:CANCEL,  STATUS:CANCELLED (gleiche UID → Kalender-Apps, die den
//                    ursprünglichen Termin schon importiert haben, bieten an, ihn zu entfernen)
export function erzeugeReservierungICS(p: ReservierungICSParams, storniert = false): string {
  const start = berlinZuUTC(p.datum, p.startZeit)
  const ende = berlinZuUTC(p.datum, p.endZeit)
  const uid = `reservierung-${p.reservierungId}@${UID_DOMAIN}`
  const titel = escapeICSText(`Kindergeburtstag ${p.logeName} – Upsalla Kinderpark`)
  const beschreibung = escapeICSText(`Geburtstagsreservierung für ${p.vorname} in der Loge ${p.logeName}.`)

  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Upsalla Kinderpark//Reservierung//DE',
    `METHOD:${storniert ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSUtc(new Date())}`,
    `DTSTART:${formatICSUtc(start)}`,
    `DTEND:${formatICSUtc(ende)}`,
    `SUMMARY:${titel}`,
    `DESCRIPTION:${beschreibung}`,
    `LOCATION:${escapeICSText(ADRESSE)}`,
    `STATUS:${storniert ? 'CANCELLED' : 'CONFIRMED'}`,
    `SEQUENCE:${storniert ? 1 : 0}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return zeilen.join('\r\n')
}
