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

// istTeuerterTag: optionaler Override (inkl. Feiertage/Ferien); ohne Argument → nur Wochenende
export function getVerfuegbareSlots(datum: Date, istTeuerterTag?: boolean): ZeitslotInfo[] {
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

// Prüft loge-spezifische Verfügbarkeitsregeln (z.B. "Runde Tische unten" nur Sa/So Slot 1)
export function logeIstVerfuegbarFuerSlot(
  verfuegbarkeitRegel: string | null,
  datum: Date,
  zeitslot: number,
): boolean {
  if (!verfuegbarkeitRegel) return true
  if (verfuegbarkeitRegel === 'SA_SO_SLOT1') {
    const tag = datum.getDay()
    return (tag === 0 || tag === 6) && zeitslot === 1
  }
  return true
}
