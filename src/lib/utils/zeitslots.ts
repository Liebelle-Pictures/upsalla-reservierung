export interface ZeitslotInfo {
  nummer: 1 | 2
  start: string
  ende: string
}

const SLOTS_WOCHENTAG: ZeitslotInfo[] = [
  { nummer: 1, start: '15:00', ende: '19:00' },
]

const SLOTS_WOCHENENDE: ZeitslotInfo[] = [
  { nummer: 1, start: '10:30', ende: '14:30' },
  { nummer: 2, start: '15:00', ende: '19:00' },
]

// Jährlich wiederkehrende Schließtage — der Park ist an diesen Tagen komplett zu,
// unabhängig von Wochentag/Feiertagsregelung (Silvester, Neujahr)
const GESCHLOSSENE_TAGE: Array<{ monat: number; tag: number; name: string }> = [
  { monat: 12, tag: 31, name: 'Silvester' },
  { monat: 1, tag: 1, name: 'Neujahr' },
]

export function istGeschlossen(datum: Date): boolean {
  return GESCHLOSSENE_TAGE.some(g => datum.getMonth() + 1 === g.monat && datum.getDate() === g.tag)
}

export function getSchliesstagName(datum: Date): string | null {
  return GESCHLOSSENE_TAGE.find(g => datum.getMonth() + 1 === g.monat && datum.getDate() === g.tag)?.name ?? null
}

// istTeuerterTag: optionaler Override (inkl. Feiertage/Ferien); ohne Argument → nur Wochenende
export function getVerfuegbareSlots(datum: Date, istTeuerterTag?: boolean): ZeitslotInfo[] {
  if (istGeschlossen(datum)) return []
  const tag = datum.getDay()
  const premium = istTeuerterTag ?? (tag === 0 || tag === 6)
  return premium ? SLOTS_WOCHENENDE : SLOTS_WOCHENTAG
}

export function istWochenende(datum: Date): boolean {
  const tag = datum.getDay()
  return tag === 0 || tag === 6
}

// Einzige Quelle der Wahrheit für "welche Uhrzeit bedeutet zeitslot X an diesem Tag".
// WICHTIG: zeitslot=1 bedeutet an einem normalen Wochentag 15:00–19:00 (einziger Slot),
// aber an einem teuren Tag (Wochenende/Feiertag/Ferien) 10:30–14:30 — die Slot-NUMMER
// allein sagt nichts über die Uhrzeit aus, man braucht immer auch istTeuerterTag.
export function zeitslotZeitraum(zeitslot: number, istTeuerterTag: boolean): { start: string; ende: string } {
  if (istTeuerterTag && zeitslot === 1) return { start: '10:30', ende: '14:30' }
  return { start: '15:00', ende: '19:00' }
}

// Gruppenbuchungen laufen technisch über zeitslot=1 (wie jede andere Wochentag-Buchung),
// die tatsächliche Uhrzeit ist aber flexibel/vom Team festgelegt (spätestens bis 13:30 Uhr) —
// deshalb beim Anzeigen NIE die normale zeitslotZeitraum()-Zeit (15:00–19:00) zeigen, sondern
// diesen Text. Überall verwenden, wo die Uhrzeit EINER konkreten Reservierung angezeigt wird
// (Detailansicht, SMS) — nicht in den Kalender-Spaltenköpfen, die sind slot-weit, nicht loge-weit.
export const GRUPPEN_ZEIT_ANZEIGE = 'vormittags, genaue Uhrzeit nach Absprache (bis spätestens 13:30 Uhr)'

// Prüft loge-spezifische Verfügbarkeitsregeln (z.B. "Runde Tische unten": an jedem
// Wochentag verfügbar, am Wochenende aber nur vormittags/Slot 1, nicht nachmittags)
export function logeIstVerfuegbarFuerSlot(
  verfuegbarkeitRegel: string | null,
  datum: Date,
  zeitslot: number,
): boolean {
  if (!verfuegbarkeitRegel) return true
  if (verfuegbarkeitRegel === 'KEIN_WE_NACHMITTAG') {
    const tag = datum.getDay()
    const istWochenende = tag === 0 || tag === 6
    return !(istWochenende && zeitslot === 2)
  }
  // Gruppenbuchungen: nur Montag bis Freitag (Upsalla-Vorgabe, 2026-09-18). Die genaue
  // Uhrzeit ist flexibel (spätestens bis 13:30 Uhr) und wird vom Team bei der Bestätigung
  // festgelegt — deshalb kein eigener Zeitslot, nur diese Tages-Einschränkung.
  if (verfuegbarkeitRegel === 'NUR_WOCHENTAG') {
    const tag = datum.getDay()
    return tag !== 0 && tag !== 6
  }
  return true
}
