// Eingabe-Validierung der Online-Buchung: Datum/Buchungsfenster und Buchungsformular.

import { MIN_VORLAUF_TAGE, MAX_VORAUS_TAGE, ZEITZONE } from './konfiguration'
import { istGueltigeTelefonnummer, zuE164 } from '@/lib/utils/telefon'
import { istGeschlossen, getVerfuegbareSlots } from '@/lib/utils/zeitslots'

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

// ─── Buchungsformular (POST /api/buchen/[standort]/reservieren) ─────────────────────

export interface Buchungsanfrage {
  datum: string
  zeitslot: number
  loge_id: string
  kinder_anzahl: number
  erwachsene_anzahl: number
  vorname: string
  nachname: string
  telefon: string         // normalisiert: lokales Format ohne Leerzeichen (0...) bzw. +.. bei Ausland
  email: string           // getrimmt, kleingeschrieben
  notizen: string | null
  idempotenz_schluessel: string
}

export type ValidierungsErgebnis =
  | { ok: true; daten: Buchungsanfrage }
  | { ok: false; feld: string; hinweis: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Pragmatisch: etwas@etwas.tld, keine Leerzeichen
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const GRENZEN = {
  kinder: { min: 1, max: 20 },
  erwachsene: { min: 0, max: 20 },
  nameMax: 60,
  notizenMax: 500,
  emailMax: 254,
} as const

// Telefonnummer so speichern, wie die meisten Bestandskunden sie haben: deutsche Nummern als
// 0..., Auslandsnummern als +.., jeweils ohne Leerzeichen/Klammern/Bindestriche.
export function normalisiereTelefon(nummer: string): string {
  const e164 = zuE164(nummer)
  return e164.startsWith('+49') ? `0${e164.slice(3)}` : e164
}

// Vergleichsschlüssel für die Kundensuche: Bestandsdaten liegen gemischt vor
// ("0152 ...", "+49152...", "0152..."), daher immer über E.164 vergleichen.
export function telefonSchluessel(nummer: string): string {
  return zuE164(nummer)
}

function ganzzahl(wert: unknown): number | null {
  return typeof wert === 'number' && Number.isInteger(wert) ? wert : null
}

function text(wert: unknown): string | null {
  return typeof wert === 'string' ? wert.trim() : null
}

// Prüft alles, was ohne Datenbank prüfbar ist. Logen-Regeln und Belegung prüft die Route.
// jetzt nur für Tests.
export function validiereBuchungsanfrage(body: unknown, jetzt: Date = new Date()): ValidierungsErgebnis {
  if (!body || typeof body !== 'object') return { ok: false, feld: 'body', hinweis: 'Ungültige Anfrage.' }
  const b = body as Record<string, unknown>

  const datum = text(b.datum)
  if (!istGueltigesDatum(datum)) return { ok: false, feld: 'datum', hinweis: 'Bitte wählt ein gültiges Datum.' }
  if (!istImBuchungsfenster(datum, jetzt)) return { ok: false, feld: 'datum', hinweis: 'Dieses Datum kann online nicht gebucht werden.' }
  const datumObj = new Date(datum + 'T00:00:00')
  if (istGeschlossen(datumObj)) return { ok: false, feld: 'datum', hinweis: 'An diesem Tag ist der Park geschlossen.' }

  const zeitslot = ganzzahl(b.zeitslot)
  // Hier nur 1 oder 2. Ob der Slot an diesem Tag existiert, hängt auch an Feiertagen/Ferien
  // (DB) und wird in der Route mit slotExistiert() geprüft.
  if (zeitslot !== 1 && zeitslot !== 2) {
    return { ok: false, feld: 'zeitslot', hinweis: 'Diese Uhrzeit gibt es an diesem Tag nicht.' }
  }

  const logeId = text(b.loge_id)
  if (!logeId || !UUID_RE.test(logeId)) return { ok: false, feld: 'loge_id', hinweis: 'Bitte wählt eine Loge.' }

  const kinder = ganzzahl(b.kinder_anzahl)
  if (kinder === null || kinder < GRENZEN.kinder.min || kinder > GRENZEN.kinder.max) {
    return { ok: false, feld: 'kinder_anzahl', hinweis: `Bitte gebt ${GRENZEN.kinder.min} bis ${GRENZEN.kinder.max} Kinder an.` }
  }
  const erwachsene = ganzzahl(b.erwachsene_anzahl)
  if (erwachsene === null || erwachsene < GRENZEN.erwachsene.min || erwachsene > GRENZEN.erwachsene.max) {
    return { ok: false, feld: 'erwachsene_anzahl', hinweis: `Bitte gebt ${GRENZEN.erwachsene.min} bis ${GRENZEN.erwachsene.max} Erwachsene an.` }
  }

  const vorname = text(b.vorname)
  if (!vorname || vorname.length > GRENZEN.nameMax) return { ok: false, feld: 'vorname', hinweis: 'Bitte gebt euren Vornamen an.' }
  const nachname = text(b.nachname)
  if (!nachname || nachname.length > GRENZEN.nameMax) return { ok: false, feld: 'nachname', hinweis: 'Bitte gebt euren Nachnamen an.' }

  const telefonRoh = text(b.telefon)
  if (!telefonRoh || !istGueltigeTelefonnummer(telefonRoh)) return { ok: false, feld: 'telefon', hinweis: 'Bitte gebt eine gültige Telefonnummer an.' }

  const email = text(b.email)?.toLowerCase() ?? ''
  if (!email || email.length > GRENZEN.emailMax || !EMAIL_RE.test(email)) return { ok: false, feld: 'email', hinweis: 'Bitte gebt eine gültige E-Mail-Adresse an.' }

  const notizen = b.notizen === undefined || b.notizen === null ? '' : text(b.notizen)
  if (notizen === null || notizen.length > GRENZEN.notizenMax) return { ok: false, feld: 'notizen', hinweis: `Notizen bitte höchstens ${GRENZEN.notizenMax} Zeichen.` }

  if (b.agb_akzeptiert !== true) return { ok: false, feld: 'agb_akzeptiert', hinweis: 'Bitte akzeptiert die AGB.' }
  // Datenschutz: keine Einwilligung (Art. 6 Abs. 1 lit. b DSGVO), nur Hinweis im Widget →
  // datenschutz_akzeptiert wird nicht mehr verlangt und ignoriert.
  // newsletter_opt_in: kein Haken mehr im Widget → wird ignoriert (Neukunden online immer false)

  const schluessel = text(b.idempotenz_schluessel)
  if (!schluessel || !UUID_RE.test(schluessel)) return { ok: false, feld: 'idempotenz_schluessel', hinweis: 'Ungültige Anfrage. Bitte ladet die Seite neu.' }

  return {
    ok: true,
    daten: {
      datum, zeitslot, loge_id: logeId.toLowerCase(), kinder_anzahl: kinder, erwachsene_anzahl: erwachsene,
      vorname, nachname, telefon: normalisiereTelefon(telefonRoh), email,
      notizen: notizen ? notizen : null,
      idempotenz_schluessel: schluessel.toLowerCase(),
    },
  }
}

// Gibt es diesen Slot an diesem Tag? istTeuerterTag aus istPreisteuerterTag (inkl. Feiertage/Ferien).
export function slotExistiert(datum: string, zeitslot: number, istTeuerterTag: boolean): boolean {
  return getVerfuegbareSlots(new Date(datum + 'T00:00:00'), istTeuerterTag).some(s => s.nummer === zeitslot)
}

// Nur echte https-Links durchlassen (zusätzlich zum CHECK-Constraint in der DB)
export function sichereBildUrl(wert: unknown): string | null {
  if (typeof wert !== 'string') return null
  try {
    const url = new URL(wert.trim())
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
