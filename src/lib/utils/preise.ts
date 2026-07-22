// Preise laut KONZEPT.md
export const FREIE_BEGLEITPERSONEN = 3
export const KIND_PREIS_WOCHENTAG = 23.0
export const KIND_PREIS_WOCHENENDE = 27.0
export const ERWACHSENE_PREIS_WOCHENTAG = 6.5
export const ERWACHSENE_PREIS_WOCHENENDE = 7.5

export function berechneGesamtbetrag(
  kinderAnzahl: number,
  istWochenende: boolean,
  erwachseneAnzahl = 0,
): number {
  const kindPreis = kinderAnzahl * (istWochenende ? KIND_PREIS_WOCHENENDE : KIND_PREIS_WOCHENTAG)
  const zahlendErwachsene = Math.max(0, erwachseneAnzahl - FREIE_BEGLEITPERSONEN)
  const erwachsenePreis = zahlendErwachsene * (istWochenende ? ERWACHSENE_PREIS_WOCHENENDE : ERWACHSENE_PREIS_WOCHENTAG)
  return kindPreis + erwachsenePreis
}

export function berechneAnzahlung(gesamtbetrag: number): number {
  return Math.round(gesamtbetrag * 0.2 * 100) / 100
}

export function berechneZahlendErwachsene(erwachseneAnzahl: number): number {
  return Math.max(0, erwachseneAnzahl - FREIE_BEGLEITPERSONEN)
}
