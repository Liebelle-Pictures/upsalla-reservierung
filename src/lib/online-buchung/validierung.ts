// Eingabe-Validierung der Online-Buchung (Phase 3: Datum + Buchungsfenster;
// Phase 4 ergänzt die Validierung des Buchungsformulars).

import { MIN_VORLAUF_TAGE, MAX_VORAUS_TAGE, ZEITZONE } from './konfiguration'

// Strikt 'YYYY-MM-DD' und ein echtes Kalenderdatum (kein 2026-02-31)
export function istGueltigesDatum(wert: string | null | undefined): wert is string {
  if (!wert || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false
  const [j, m, t] = wert.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1, t))
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t
}

// Strikt 'YYYY-MM'
export function istGueltigerMonat(wert: string | null | undefined): wert is string {
  if (!wert || !/^\d{4}-\d{2}$/.test(wert)) return false
  const m = Number(wert.slice(5, 7))
  return m >= 1 && m <= 12
}

// Heutiges Datum in der Zeitzone des Parks als 'YYYY-MM-DD' (Server läuft in UTC)
export function heuteImPark(jetzt: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZEITZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(jetzt)
}

function plusTage(datum: string, tage: number): string {
  const [j, m, t] = datum.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1, t + tage))
  return d.toISOString().slice(0, 10)
}

// Erster und letzter online buchbarer Tag ('YYYY-MM-DD', inklusiv)
export function buchungsfenster(jetzt: Date = new Date()): { von: string; bis: string } {
  const heute = heuteImPark(jetzt)
  return { von: plusTage(heute, MIN_VORLAUF_TAGE), bis: plusTage(heute, MAX_VORAUS_TAGE) }
}

export function istImBuchungsfenster(datum: string, jetzt: Date = new Date()): boolean {
  const { von, bis } = buchungsfenster(jetzt)
  return datum >= von && datum <= bis
}
