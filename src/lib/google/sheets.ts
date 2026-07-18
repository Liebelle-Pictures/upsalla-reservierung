import { google } from 'googleapis'

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!
const SHEET_TAB = 'Kunden'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export interface KundeZeile {
  vorname: string
  nachname: string
  telefon: string
  email: string
  kindGeburtstag?: string | null
  letzteReservierung?: string | null
  logeName?: string | null
}

// Einen neuen Kunden ans Sheet anhängen
export async function kundeInSheetEintragen(kunde: KundeZeile): Promise<void> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const zeile = [
    kunde.vorname,
    kunde.nachname,
    kunde.telefon,
    kunde.email,
    kunde.kindGeburtstag ?? '',
    kunde.letzteReservierung ?? '',
    kunde.logeName ?? '',
    new Date().toLocaleDateString('de-DE'),
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:H`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [zeile] },
  })
}

// Gesamten Sheet mit aktuellen Daten überschreiben (für Sync-Cron)
export async function sheetKompletSynchronisieren(kunden: KundeZeile[]): Promise<void> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const kopfzeile = ['Vorname', 'Nachname', 'Telefon', 'E-Mail', 'Kind Geburtstag', 'Letzte Reservierung', 'Loge', 'Aktualisiert']

  const zeilen = kunden.map(k => [
    k.vorname,
    k.nachname,
    k.telefon,
    k.email,
    k.kindGeburtstag ?? '',
    k.letzteReservierung ?? '',
    k.logeName ?? '',
    new Date().toLocaleDateString('de-DE'),
  ])

  // Erst löschen, dann neu schreiben
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:H`,
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [kopfzeile, ...zeilen] },
  })
}
