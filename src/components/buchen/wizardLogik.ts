// Reine Logik des Buchungs-Widgets (ohne React, ohne DB) — testbar mit
// scripts/test-buchen-wizard.ts. Preise kommen ausschließlich aus src/lib/utils/preise.ts,
// verbindlich rechnet aber immer der Server (reservieren).
import {
  berechneGeburtstagsBetrag, berechneAnzahlung, berechneZahlendErwachsene, abrechnungsKinder, istGanzeLogeWirksam,
  MINDEST_KINDER_ABRECHNUNG, GANZE_LOGE_MIN_KINDER,
} from '@/lib/utils/preise'
import { GRENZEN, EMAIL_RE } from '@/lib/online-buchung/validierung'
import { istGueltigeTelefonnummer } from '@/lib/utils/telefon'

// ─── Antworten der öffentlichen API ─────────────────────────────────────────────

export type TagStatus = 'geschlossen' | 'ausgebucht' | 'wenige' | 'frei' | 'nicht_buchbar'

export interface MonatsTag {
  datum: string
  status: TagStatus
  wochenendpreis: boolean
}

export interface MonatAntwort {
  monat: string
  buchbar_von: string
  buchbar_bis: string
  tage: MonatsTag[]
}

export interface LogeOption {
  loge_id: string
  name: string
  ist_babywelt: boolean
  max_kinder: number
  // Am zweiten Tisch feiert schon eine andere Gruppe
  geteilt: boolean
  // BBQ Zelt o.ä.: immer nur eine Gruppe → gehört euch ganz, keine Option „ganze Loge“
  flexibel: boolean
  // Foto der Loge (Migration 012) oder null → Symbol
  bild_url: string | null
}

// ─── Logen-Regel und Etiketten (Modul „Ganze Loge“, docs/module/online-buchung.md, 10) ─────
// 1–9 Kinder: eigener Tisch, der zweite Tisch kann von einer anderen Gruppe gebucht werden.
// Ab 10 Kindern (und im BBQ Zelt): die ganze Loge. Kleine Gruppen können sie dazubuchen.

export const TEXT_REGEL_TISCH = '1–9 Kinder: euer eigener Tisch – die Loge kann mit einer anderen Gruppe geteilt werden'
export const TEXT_REGEL_GANZ = 'ab 10 Kindern: die ganze Loge gehört euch'
export const TEXT_GANZ = 'Ganze Loge für euch'
export const TEXT_TISCH_FREI = 'Eigener Tisch · zweiter Tisch kann noch gebucht werden'
export const TEXT_TISCH_BELEGT = 'Eigener Tisch · am Nachbartisch feiert schon eine Gruppe'
// Längere Fassung für die Übersicht
export const TEXT_TISCH_FREI_LANG = 'Euer eigener Tisch – den zweiten Tisch der Loge kann noch eine andere Gruppe buchen.'
export const TEXT_TISCH_BELEGT_LANG = 'Euer eigener Tisch – am zweiten Tisch der Loge feiert schon eine andere Gruppe.'

export type LogenEtikett = 'ganz' | 'tisch_frei' | 'tisch_belegt'

// Etikett je Kinderzahl: ≥10 Kinder, BBQ Zelt oder dazugebuchte ganze Loge → grün „ganz“
export function logenEtikett(loge: Pick<LogeOption, 'geteilt' | 'flexibel'>, kinder: number, ganzeLoge = false): LogenEtikett {
  if (loge.flexibel || kinder >= GANZE_LOGE_MIN_KINDER || ganzeLoge) return 'ganz'
  return loge.geteilt ? 'tisch_belegt' : 'tisch_frei'
}

export function etikettText(e: LogenEtikett): string {
  return e === 'ganz' ? TEXT_GANZ : e === 'tisch_frei' ? TEXT_TISCH_FREI : TEXT_TISCH_BELEGT
}

// Passt die Gruppe in diese Loge? max_kinder liefert der Server schon nach den Regeln von
// reserviere_online (halb belegt: höchstens 9 und Restplätze).
export function passtFuerKinder(loge: Pick<LogeOption, 'max_kinder'>, kinder: number): boolean {
  return kinder <= loge.max_kinder
}

// Option „Ganze Loge nur für euch“: nur bei 1–9 Kindern, komplett leerer Loge, nicht BBQ Zelt
export function ganzeLogeAngeboten(loge: Pick<LogeOption, 'geteilt' | 'flexibel'>, kinder: number): boolean {
  return !loge.geteilt && istGanzeLogeWirksam(true, kinder, loge.flexibel)
}

// Aufpreis für „ganze Loge“ am gewählten Tag (gleiche Formel wie der Server)
export function aufpreisGanzeLoge(kinder: number, erwachsene: number, wochenendpreis: boolean): number {
  return preisVorschau(kinder, erwachsene, wochenendpreis, true).gesamt - preisVorschau(kinder, erwachsene, wochenendpreis, false).gesamt
}

export function textGanzeLogeOption(aufpreis: number): string {
  return `Ganze Loge nur für euch (+${euro(aufpreis)})`
}

// Statt Newsletter-Haken im Kontaktformular
export const TEXT_ANGEBOT_HINWEIS = 'Etwa einmal im Jahr schicken wir euch ein Angebot für den nächsten Kindergeburtstag. Ihr könnt dem jederzeit widersprechen.'

export interface SlotOption {
  zeitslot: number
  start: string
  ende: string
  logen: LogeOption[]
}

export interface TagAntwort {
  datum: string
  buchbar: boolean
  grund?: 'nicht_buchbar' | 'geschlossen'
  wochenendpreis?: boolean
  preis_pro_kind?: number
  preis_pro_erwachsener?: number
  slots: SlotOption[]
}

// ─── Schritte ───────────────────────────────────────────────────────────────────

export const SCHRITTE = ['Datum', 'Kinder', 'Uhrzeit & Loge', 'Kontakt', 'Übersicht'] as const
export type Schritt = 1 | 2 | 3 | 4 | 5

export interface Kontakt {
  vorname: string
  nachname: string
  telefon: string
  email: string
  notizen: string
  agb_akzeptiert: boolean
  website: string // Honeypot, bleibt leer
}

export const LEERER_KONTAKT: Kontakt = {
  vorname: '', nachname: '', telefon: '', email: '', notizen: '',
  agb_akzeptiert: false, website: '',
}

// In welchem Schritt steht ein Feld, das der Server als fehlerhaft meldet?
export function schrittFuerFeld(feld: string | undefined): Schritt {
  switch (feld) {
    case 'datum': return 1
    case 'kinder_anzahl':
    case 'erwachsene_anzahl': return 2
    case 'zeitslot':
    case 'loge_id':
    case 'ganze_loge': return 3
    case 'vorname':
    case 'nachname':
    case 'telefon':
    case 'email':
    case 'notizen':
    case 'agb_akzeptiert': return 4
    default: return 5
  }
}

// ─── Preise (nur Anzeige) ───────────────────────────────────────────────────────

export interface PreisVorschau {
  gesamt: number
  anzahlung: number
  rest: number
  abrechenbareKinder: number
  zahlendeErwachsene: number
}

export function preisVorschau(kinder: number, erwachsene: number, wochenendpreis: boolean, ganzeLoge = false): PreisVorschau {
  const gesamt = berechneGeburtstagsBetrag(kinder, wochenendpreis, erwachsene, ganzeLoge)
  const anzahlung = berechneAnzahlung(gesamt)
  return {
    gesamt,
    anzahlung,
    rest: Math.round((gesamt - anzahlung) * 100) / 100,
    abrechenbareKinder: Math.max(abrechnungsKinder(kinder, ganzeLoge), MINDEST_KINDER_ABRECHNUNG),
    zahlendeErwachsene: berechneZahlendErwachsene(erwachsene),
  }
}

export const MAX_KINDER = GRENZEN.kinder.max
export const MAX_ERWACHSENE = GRENZEN.erwachsene.max

export function begrenze(wert: number, min: number, max: number): number {
  return Math.min(Math.max(wert, min), max)
}

// ─── Kontaktformular (gleiche Regeln wie validiereBuchungsanfrage) ──────────────

export type KontaktFehler = Partial<Record<keyof Kontakt, string>>

export function pruefeKontakt(k: Kontakt): KontaktFehler {
  const f: KontaktFehler = {}
  if (!k.vorname.trim() || k.vorname.trim().length > GRENZEN.nameMax) f.vorname = 'Bitte gebt euren Vornamen an.'
  if (!k.nachname.trim() || k.nachname.trim().length > GRENZEN.nameMax) f.nachname = 'Bitte gebt euren Nachnamen an.'
  if (!istGueltigeTelefonnummer(k.telefon)) f.telefon = 'Bitte gebt eine gültige Handynummer an, z. B. 0151 23456789.'
  const email = k.email.trim()
  if (!email || email.length > GRENZEN.emailMax || !EMAIL_RE.test(email)) f.email = 'Bitte gebt eine gültige E-Mail-Adresse an.'
  if (k.notizen.trim().length > GRENZEN.notizenMax) f.notizen = `Bitte höchstens ${GRENZEN.notizenMax} Zeichen.`
  if (!k.agb_akzeptiert) f.agb_akzeptiert = 'Bitte akzeptiert die AGB.'
  return f
}

// ─── Reaktion auf die Antwort von POST /reservieren ─────────────────────────────

export type Reaktion =
  | { art: 'weiterleiten'; url: string }
  // Hold abgelaufen / Schlüssel schon benutzt → neuer Schlüssel, Daten bleiben, nochmal absenden
  | { art: 'neuer_schluessel'; hinweis: string }
  // Slot inzwischen vergeben → zurück zu Schritt 3 (Uhrzeit & Loge), Verfügbarkeit neu laden
  | { art: 'zurueck_zur_auswahl'; hinweis: string }
  // Erster Request läuft noch → gleichen Request kurz danach wiederholen
  | { art: 'wiederholen'; hinweis: string }
  | { art: 'bereits_bezahlt'; hinweis: string }
  | { art: 'feld'; schritt: Schritt; feld?: string; hinweis: string }
  // Turnstile-Token abgelehnt/abgelaufen → Widget neu laden, nochmal absenden
  | { art: 'sicherheitspruefung'; hinweis: string }
  | { art: 'fehler'; hinweis: string }

const ALLGEMEINER_FEHLER = 'Da ist etwas schiefgelaufen. Bitte versucht es gleich noch einmal oder ruft uns an: 0202 2623339.'

export const HINWEIS_NEUER_SCHLUESSEL =
  'Die Reservierungszeit ist abgelaufen, deshalb haben wir eure Buchung neu vorbereitet. Eure Angaben sind noch da. Tippt einfach noch einmal auf „Zahlungspflichtig buchen“.'

export function reaktionAufAntwort(status: number, body: unknown): Reaktion {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const hinweis = typeof b.hinweis === 'string' && b.hinweis ? b.hinweis : null

  if (status === 200 && typeof b.checkout_url === 'string' && /^https:\/\//.test(b.checkout_url)) {
    return { art: 'weiterleiten', url: b.checkout_url }
  }
  if (status === 409) {
    switch (b.grund) {
      case 'ABGELAUFEN':
      case 'SCHLUESSEL_VERWENDET':
        return { art: 'neuer_schluessel', hinweis: HINWEIS_NEUER_SCHLUESSEL }
      case 'SLOT_BELEGT':
      case 'KAPAZITAET':
      case 'LOGE_UNGUELTIG':
        return {
          art: 'zurueck_zur_auswahl',
          hinweis: `Schade, da war jemand schneller. ${hinweis ?? 'Diese Loge ist leider nicht mehr frei.'} Wir haben die freien Termine neu geladen.`,
        }
      case 'IN_BEARBEITUNG':
        return { art: 'wiederholen', hinweis: hinweis ?? 'Eure Buchung wird gerade verarbeitet. Einen Moment bitte.' }
      case 'BEREITS_BEZAHLT':
        return { art: 'bereits_bezahlt', hinweis: hinweis ?? 'Diese Buchung ist bereits bezahlt. Die Bestätigung kommt per SMS und E-Mail.' }
    }
    return { art: 'fehler', hinweis: hinweis ?? ALLGEMEINER_FEHLER }
  }
  if (status === 400) {
    const feld = typeof b.feld === 'string' ? b.feld : undefined
    if (feld === 'turnstile_token') return { art: 'sicherheitspruefung', hinweis: hinweis ?? ALLGEMEINER_FEHLER }
    return { art: 'feld', schritt: schrittFuerFeld(feld), feld, hinweis: hinweis ?? ALLGEMEINER_FEHLER }
  }
  if (status === 404) return { art: 'fehler', hinweis: 'Die Online-Buchung ist gerade nicht verfügbar. Ruft uns gerne an: 0202 2623339.' }
  if (status === 429) return { art: 'fehler', hinweis: hinweis ?? 'Zu viele Versuche. Bitte wartet ein paar Minuten und versucht es dann erneut.' }
  return { art: 'fehler', hinweis: hinweis ?? ALLGEMEINER_FEHLER }
}

// ─── Kalender ───────────────────────────────────────────────────────────────────

// 'YYYY-MM' ± n Monate
export function monatPlus(monat: string, n: number): string {
  const [j, m] = monat.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Wochen des Monats, Montag zuerst; null = Leerfeld vor dem 1. bzw. nach dem Letzten
export function kalenderWochen(monat: string): Array<Array<string | null>> {
  const [j, m] = monat.split('-').map(Number)
  const tage = new Date(Date.UTC(j, m, 0)).getUTCDate()
  const ersterWochentag = (new Date(Date.UTC(j, m - 1, 1)).getUTCDay() + 6) % 7 // Mo=0
  const zellen: Array<string | null> = Array(ersterWochentag).fill(null)
  for (let t = 1; t <= tage; t++) zellen.push(`${monat}-${String(t).padStart(2, '0')}`)
  while (zellen.length % 7 !== 0) zellen.push(null)
  const wochen: Array<Array<string | null>> = []
  for (let i = 0; i < zellen.length; i += 7) wochen.push(zellen.slice(i, i + 7))
  return wochen
}

export function istWaehlbar(status: TagStatus): boolean {
  return status === 'frei' || status === 'wenige'
}

// ─── Formatierung ───────────────────────────────────────────────────────────────

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export function euro(betrag: number): string {
  // 27,00 € → 27 €, 5,40 € bleibt
  return EURO.format(betrag).replace(',00', '')
}

function datumUtc(datum: string): Date {
  const [j, m, t] = datum.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, t, 12))
}

// 'Samstag, 14. November 2026'
export function datumLang(datum: string): string {
  return datumUtc(datum).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// 'November 2026'
export function monatName(monat: string): string {
  return datumUtc(`${monat}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function slotBezeichnung(slot: Pick<SlotOption, 'start'>): string {
  return Number(slot.start.slice(0, 2)) < 13 ? 'Vormittags' : 'Nachmittags'
}
