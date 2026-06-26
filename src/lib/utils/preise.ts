// Preise laut KONZEPT.md
const PREISE = {
  wochentag: { proKind: 23.0, zusatzKind: 6.5, mindestKinder: 6 },
  wochenende: { proKind: 27.0, zusatzKind: 7.5, mindestKinder: 6 },
} as const

export function berechneGesamtbetrag(
  kinderAnzahl: number,
  istWochenende: boolean,
): number {
  const tarif = istWochenende ? PREISE.wochenende : PREISE.wochentag
  const basisKinder = Math.min(kinderAnzahl, tarif.mindestKinder)
  const zusatzKinder = Math.max(0, kinderAnzahl - tarif.mindestKinder)

  return (
    basisKinder * tarif.proKind +
    zusatzKinder * tarif.zusatzKind
  )
}

export function berechneAnzahlung(gesamtbetrag: number): number {
  return Math.round(gesamtbetrag * 0.2 * 100) / 100
}
