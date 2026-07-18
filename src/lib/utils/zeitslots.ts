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
