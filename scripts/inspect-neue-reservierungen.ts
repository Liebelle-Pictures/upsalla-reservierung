import pkg from 'xlsx'
const { readFile, utils } = pkg

const wb = readFile('Geburtstagskalender_Neue_Reservierungen-v5.xlsx')
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }) as string[][]

const logen = new Set<string>()
const uhrzeiten = new Set<string>()
let datenMin = '', datenMax = ''

console.log(`${rows.length - 1} Zeilen\n`)

for (let i = 1; i < rows.length; i++) {
  const [datum, uhrzeit, loge] = rows[i]
  if (loge) logen.add(loge)
  if (uhrzeit) uhrzeiten.add(uhrzeit)
  if (datum) {
    if (!datenMin || datum < datenMin) datenMin = datum
    if (!datenMax || datum > datenMax) datenMax = datum
  }
}

console.log('Unique Logen:', JSON.stringify([...logen].sort(), null, 1))
console.log('Unique Uhrzeiten:', JSON.stringify([...uhrzeiten].sort()))
console.log('Datumsbereich:', datenMin, '-', datenMax)

console.log('\n--- Auffällige Zeilen ---')
for (let i = 1; i < rows.length; i++) {
  const [datum, uhrzeit, loge, name, telefon, , kinder, erwachsene, notizen] = rows[i]
  const flags: string[] = []
  if (!telefon) flags.push('KEIN_TELEFON')
  if (!kinder || !/^\d+$/.test(kinder.trim())) flags.push('KINDERANZAHL_UNKLAR')
  if (erwachsene && !/^\d+$/.test(erwachsene.trim())) flags.push('ERWACHSENE_UNKLAR')
  if (uhrzeit !== '15:00 - 19:00' && uhrzeit !== '10:30 - 14:30') flags.push('UNTYPISCHE_UHRZEIT')
  if (loge.toLowerCase().includes('runde tische') && kinder && parseInt(kinder) < 18) flags.push('RUNDE_TISCHE_UNTER_MIN')
  if (datum === '2026-12-31' || datum === '2027-01-01' || datum === '2026-01-01') flags.push('SCHLIESSTAG')
  if (flags.length) {
    console.log(`Zeile ${i}: [${flags.join(', ')}]`, JSON.stringify({ datum, uhrzeit, loge, name, telefon, kinder, erwachsene, notizen }))
  }
}

console.log('\n--- Datum+Uhrzeit+Loge Kollisionen (gleiche Loge, gleicher Slot) ---')
const slotMap = new Map<string, Array<{ i: number; kinder: string; name: string }>>()
for (let i = 1; i < rows.length; i++) {
  const [datum, uhrzeit, loge, name, , , kinder] = rows[i]
  const key = `${datum}|${uhrzeit}|${loge}`
  const arr = slotMap.get(key) ?? []
  arr.push({ i, kinder, name })
  slotMap.set(key, arr)
}
for (const [key, arr] of slotMap) {
  if (arr.length > 1) console.log(key, JSON.stringify(arr))
}
