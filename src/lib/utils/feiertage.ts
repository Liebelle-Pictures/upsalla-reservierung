import { supabaseAdmin } from '@/lib/supabase/admin'

// Lokales Datum → YYYY-MM-DD (keine Timezone-Konversion)
function datumZuStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Ostersonntag nach dem Gauss-Algorithmus
function berechneOstern(jahr: number): Date {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monat = Math.floor((h + l - 7 * m + 114) / 31)
  const tag = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(jahr, monat - 1, tag)
}

function addTage(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function gleichesDatum(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

interface Feiertag { datum: Date; name: string }

function getNRWFeiertageImJahr(jahr: number): Feiertag[] {
  const o = berechneOstern(jahr)
  return [
    { datum: new Date(jahr, 0, 1),   name: 'Neujahr' },
    { datum: addTage(o, -2),          name: 'Karfreitag' },
    { datum: o,                        name: 'Ostersonntag' },
    { datum: addTage(o, 1),           name: 'Ostermontag' },
    { datum: new Date(jahr, 4, 1),   name: 'Tag der Arbeit' },
    { datum: addTage(o, 39),          name: 'Christi Himmelfahrt' },
    { datum: addTage(o, 49),          name: 'Pfingstsonntag' },
    { datum: addTage(o, 50),          name: 'Pfingstmontag' },
    { datum: addTage(o, 60),          name: 'Fronleichnam' },
    { datum: new Date(jahr, 9, 3),   name: 'Tag der Deutschen Einheit' },
    { datum: new Date(jahr, 10, 1),  name: 'Allerheiligen' },
    { datum: new Date(jahr, 11, 25), name: '1. Weihnachtstag' },
    { datum: new Date(jahr, 11, 26), name: '2. Weihnachtstag' },
  ]
}

function getNRWFeiertagName(datum: Date): string | null {
  return getNRWFeiertageImJahr(datum.getFullYear()).find(f => gleichesDatum(f.datum, datum))?.name ?? null
}

// ─── Schulferien-Cache ────────────────────────────────────────────────────────

// Primäre Quelle: openholidaysapi.org (öffentliche Verwaltungen, inklusives End-Datum)
async function ladeVonOpenHolidaysAPI(jahr: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 7000)
    const url = `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&languageIsoCode=DE&subdivisionCode=DE-NW&validFrom=${jahr}-01-01&validTo=${jahr}-12-31`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return false
    const daten = (await res.json()) as Array<{
      startDate: string
      endDate: string
      name: Array<{ language: string; text: string }>
    }>
    if (!Array.isArray(daten) || daten.length === 0) return false

    const zeilen = daten.map(f => ({
      name: (f.name.find(n => n.language === 'DE')?.text ?? 'Ferien'),
      start_datum: f.startDate.slice(0, 10),
      end_datum:   f.endDate.slice(0, 10),   // openholidaysapi: End-Datum ist inklusiv
      jahr,
    }))
    await supabaseAdmin.from('nrw_schulferien').upsert(zeilen, { onConflict: 'name,start_datum' })
    return true
  } catch {
    return false
  }
}

// Fallback: ferien-api.de (exklusives End-Datum → -1 Tag)
async function ladeVonFerienAPI(jahr: number): Promise<void> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 7000)
    const res = await fetch(`https://ferien-api.de/api/v1/holidays/NW/${jahr}`, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return
    const daten = (await res.json()) as Array<{ name: string; start: string; end: string }>
    if (!Array.isArray(daten) || daten.length === 0) return

    const zeilen = daten.map(f => {
      const [ey, em, ed] = f.end.slice(0, 10).split('-').map(Number)
      const endMs = Date.UTC(ey, em - 1, ed) - 86400000
      const e = new Date(endMs)
      const endStr = `${e.getUTCFullYear()}-${String(e.getUTCMonth() + 1).padStart(2, '0')}-${String(e.getUTCDate()).padStart(2, '0')}`
      return { name: f.name, start_datum: f.start.slice(0, 10), end_datum: endStr, jahr }
    })
    await supabaseAdmin.from('nrw_schulferien').upsert(zeilen, { onConflict: 'name,start_datum' })
  } catch {
    // beide APIs nicht erreichbar — manuell eingefügte Daten bleiben erhalten
  }
}

async function sicherstellenDassSchulferienGeladen(jahr: number): Promise<void> {
  // Cache-Check anhand Start-Datum (kein jahr-Filter → Weihnachtsferien über Jahreswechsel OK)
  const { count } = await supabaseAdmin
    .from('nrw_schulferien')
    .select('*', { count: 'exact', head: true })
    .gte('start_datum', `${jahr}-01-01`)
    .lte('start_datum', `${jahr}-12-31`)
  if ((count ?? 0) > 0) return
  // Noch keine Daten → von API laden
  const erfolg = await ladeVonOpenHolidaysAPI(jahr)
  if (!erfolg) await ladeVonFerienAPI(jahr)
}

async function getSchulferienName(datum: Date): Promise<string | null> {
  const datumStr = datumZuStr(datum)
  await sicherstellenDassSchulferienGeladen(datum.getFullYear())
  // Kein Jahr-Filter: Weihnachtsferien die aus dem Vorjahr überlappen werden erkannt
  const { data } = await supabaseAdmin
    .from('nrw_schulferien')
    .select('name')
    .lte('start_datum', datumStr)
    .gte('end_datum', datumStr)
    .limit(1)
  return (data as { name: string }[] | null)?.[0]?.name ?? null
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

// true = 27 € Wochenendpreis gilt (Wochenende, Feiertag oder NRW Schulferien)
export async function istPreisteuerterTag(datum: Date): Promise<boolean> {
  const tag = datum.getDay()
  if (tag === 0 || tag === 6) return true
  if (getNRWFeiertagName(datum) !== null) return true
  return (await getSchulferienName(datum)) !== null
}

// Label für UI und Lena — z.B. "NRW Schulferien – Sommerferien"
export async function getPreisTypLabel(datum: Date): Promise<string> {
  const tag = datum.getDay()
  if (tag === 0 || tag === 6) return 'Wochenende'
  const feiertag = getNRWFeiertagName(datum)
  if (feiertag) return `Feiertag – ${feiertag}`
  const ferien = await getSchulferienName(datum)
  if (ferien) return `NRW Schulferien – ${ferien}`
  return 'Wochentag'
}
