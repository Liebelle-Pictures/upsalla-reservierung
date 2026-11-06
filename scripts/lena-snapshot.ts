// Lena-Antworten (api/lena/verfuegbarkeit) als Schnappschuss — Vergleich vor/nach einer Änderung
// an der Belegungslogik (z.B. Modul „Ganze Loge“). Ruft den echten Route-Handler auf (GET + POST),
// mit echten Daten, schreibt nur nichts.
//
//   npx tsx --env-file=.env.local scripts/lena-snapshot.ts --out=<datei.json> [--tage=120] [--daten=2099-11-03,2099-11-04]
//   npx tsx scripts/lena-snapshot.ts --vergleiche=<vorher.json>,<nachher.json>
//
// Vergleich: Byte für Byte pro Datum/Methode; gibt die abweichenden Daten aus.

import { readFileSync, writeFileSync } from 'node:fs'
import { NextRequest } from 'next/server'

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)

function vergleiche(vorherPfad: string, nachherPfad: string) {
  const vorher = JSON.parse(readFileSync(vorherPfad, 'utf8')) as Record<string, string>
  const nachher = JSON.parse(readFileSync(nachherPfad, 'utf8')) as Record<string, string>
  const schluessel = [...new Set([...Object.keys(vorher), ...Object.keys(nachher)])].sort()
  const abweichend = schluessel.filter(k => vorher[k] !== nachher[k])
  console.log(`${schluessel.length} Antworten verglichen, ${abweichend.length} abweichend`)
  for (const k of abweichend) console.log(`  ✗ ${k}\n    vorher:  ${vorher[k]}\n    nachher: ${nachher[k]}`)
  process.exit(abweichend.length ? 1 : 0)
}

async function schnappschuss(out: string, tage: number, feste: string[]) {
  const { GET, POST } = await import('../src/app/api/lena/verfuegbarkeit/route')
  const headers = { 'x-api-key': process.env.LENA_API_KEY!, 'content-type': 'application/json' }
  const ergebnis: Record<string, string> = {}
  const start = new Date()
  // Stille Logs der Route (console.log) unterdrücken
  const log = console.log
  console.log = () => {}
  try {
    const daten = feste.length ? feste : Array.from({ length: tage }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    for (const datum of daten) {
      const g = await GET(new NextRequest(`http://localhost/api/lena/verfuegbarkeit?datum=${datum}`, { headers }))
      ergebnis[`${datum} GET`] = `${g.status} ${await g.text()}`
      const p = await POST(new NextRequest('http://localhost/api/lena/verfuegbarkeit', { method: 'POST', headers, body: JSON.stringify({ args: { datum } }) }))
      ergebnis[`${datum} POST`] = `${p.status} ${await p.text()}`
    }
    const ohne = await GET(new NextRequest('http://localhost/api/lena/verfuegbarkeit?datum=2026-12-01'))
    ergebnis['ohne Schlüssel'] = `${ohne.status} ${await ohne.text()}`
  } finally {
    console.log = log
  }
  writeFileSync(out, JSON.stringify(ergebnis, null, 1))
  console.log(`${Object.keys(ergebnis).length} Antworten → ${out}`)
}

const vgl = arg('vergleiche')
if (vgl) vergleiche(...(vgl.split(',') as [string, string]))
else {
  const out = arg('out')
  if (!out) { console.error('--out=<datei> oder --vergleiche=<a>,<b> angeben'); process.exit(2) }
  void schnappschuss(out, Number(arg('tage') ?? 120), arg('daten')?.split(',') ?? [])
}
