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

export function getVerfuegbareSlots(datum: Date): ZeitslotInfo[] {
  const tag = datum.getDay() // 0=So, 6=Sa
  const istWochenende = tag === 0 || tag === 6
  return istWochenende ? SLOTS_WOCHENENDE : SLOTS_WOCHENTAG
}

export function istWochenende(datum: Date): boolean {
  const tag = datum.getDay()
  return tag === 0 || tag === 6
}
