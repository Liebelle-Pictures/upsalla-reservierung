import pkg from 'xlsx'
const { readFile, utils } = pkg
import path from 'node:path'

const dateiPfad = path.resolve(process.cwd(), 'Geburtstagskalender_Reservierungen.xlsx')
const arbeitsmappe = readFile(dateiPfad)

console.log('Sheets:', arbeitsmappe.SheetNames)

for (const sheetName of arbeitsmappe.SheetNames) {
  const sheet = arbeitsmappe.Sheets[sheetName]
  const zeilen = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][]
  console.log(`\n=== Sheet "${sheetName}" — ${zeilen.length} Zeilen ===`)
  console.log('Header:', JSON.stringify(zeilen[0]))
  for (let i = 1; i < zeilen.length; i++) {
    console.log(`Zeile ${i}:`, JSON.stringify(zeilen[i]))
  }

  const logen = new Set<string>()
  const uhrzeiten = new Set<string>()
  let ohneTelefon = 0
  let ohneKinderAnzahl = 0
  let datenMin = ''
  let datenMax = ''

  for (let i = 1; i < zeilen.length; i++) {
    const [datum, uhrzeit, loge, , telefon, , kinder] = zeilen[i] as string[]
    if (loge) logen.add(loge)
    if (uhrzeit) uhrzeiten.add(uhrzeit)
    if (!telefon) ohneTelefon++
    if (!kinder) ohneKinderAnzahl++
    if (datum) {
      if (!datenMin || datum < datenMin) datenMin = datum
      if (!datenMax || datum > datenMax) datenMax = datum
    }
  }

  console.log('\n--- Statistik ---')
  console.log('Unique Logen:', JSON.stringify([...logen].sort(), null, 2))
  console.log('Unique Uhrzeiten:', JSON.stringify([...uhrzeiten].sort()))
  console.log('Zeilen ohne Telefonnummer:', ohneTelefon)
  console.log('Zeilen ohne Kinderanzahl:', ohneKinderAnzahl)
  console.log('Datumsbereich:', datenMin, '-', datenMax)

  console.log('\n--- Auffällige Zeilen ---')
  const telefonZaehler = new Map<string, number[]>()
  for (let i = 1; i < zeilen.length; i++) {
    const [datum, uhrzeit, loge, name, telefon, email, kinder, erwachsene, notizen] = zeilen[i] as string[]
    const flags: string[] = []
    if (!telefon) flags.push('KEIN_TELEFON')
    if (!kinder) flags.push('KEINE_KINDERANZAHL')
    if (uhrzeit !== '15:00 - 19:00' && uhrzeit !== '10:30 - 14:30') flags.push('UNTYPISCHE_UHRZEIT')
    if (/regenbogen|zelt|ogs|komplett \(rosa/i.test(loge)) flags.push('MEHRDEUTIGE_LOGE')
    if (flags.length) {
      console.log(`Zeile ${i}: [${flags.join(', ')}]`, JSON.stringify({ datum, uhrzeit, loge, name, telefon, email, kinder, erwachsene, notizen }))
    }
    if (telefon) {
      const arr = telefonZaehler.get(telefon) ?? []
      arr.push(i)
      telefonZaehler.set(telefon, arr)
    }
  }

  console.log('\n--- Telefonnummern mit mehreren Zeilen ---')
  for (const [tel, idxs] of telefonZaehler) {
    if (idxs.length > 1) console.log(tel, '->', idxs)
  }

  console.log('\n--- Datum+Uhrzeit Kollisionen (potenzielle Doppelbelegung) ---')
  const slotZaehler = new Map<string, Array<{ i: number; loge: string }>>()
  for (let i = 1; i < zeilen.length; i++) {
    const [datum, uhrzeit, loge] = zeilen[i] as string[]
    const key = `${datum}|${uhrzeit}`
    const arr = slotZaehler.get(key) ?? []
    arr.push({ i, loge })
    slotZaehler.set(key, arr)
  }
  for (const [key, arr] of slotZaehler) {
    if (arr.length > 1) console.log(key, JSON.stringify(arr))
  }
}
