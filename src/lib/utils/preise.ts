// Preise laut KONZEPT.md
export const FREIE_BEGLEITPERSONEN = 3
export const KIND_PREIS_WOCHENTAG = 23.0
export const KIND_PREIS_WOCHENENDE = 27.0
export const ERWACHSENE_PREIS_WOCHENTAG = 6.5
export const ERWACHSENE_PREIS_WOCHENENDE = 7.5
export const MINDEST_KINDER_ABRECHNUNG = 6

export function berechneGesamtbetrag(
  kinderAnzahl: number,
  istWochenende: boolean,
  erwachseneAnzahl = 0,
): number {
  // Bei weniger als 6 Kindern wird trotzdem der Mindestpreis für 6 berechnet
  const abrechenbareKinder = Math.max(kinderAnzahl, MINDEST_KINDER_ABRECHNUNG)
  const kindPreis = abrechenbareKinder * (istWochenende ? KIND_PREIS_WOCHENENDE : KIND_PREIS_WOCHENTAG)
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

// Gruppenpreise (Kitas/Schulen) — separat von den Geburtstagspreisen oben.
// Staffelpreis: ab X Kindern gilt Y€ PRO Kind (nicht nur für die zusätzlichen).
// Unter 20 Kindern: bislang keine offizielle Vorgabe von Upsalla — Annahme ist der
// Basissatz von 9,50€, bis das bestätigt ist.
export const GRUPPEN_PREIS_AB_20 = 9.5
export const GRUPPEN_PREIS_AB_50 = 9.0
export const GRUPPEN_PREIS_AB_100 = 8.0
export const GRUPPEN_FREIE_ERWACHSENE_PRO_KINDER = 10 // 1 Erwachsener frei pro 10 Kinder

export function gruppenPreisProKind(kinderAnzahl: number): number {
  if (kinderAnzahl >= 100) return GRUPPEN_PREIS_AB_100
  if (kinderAnzahl >= 50) return GRUPPEN_PREIS_AB_50
  return GRUPPEN_PREIS_AB_20
}

export function berechneGruppenFreieErwachsene(kinderAnzahl: number): number {
  return Math.floor(kinderAnzahl / GRUPPEN_FREIE_ERWACHSENE_PRO_KINDER)
}

// Betrag berücksichtigt nur die Kinder — für Erwachsene über die Freianzahl hinaus gibt
// es noch keinen bestätigten Aufpreis von Upsalla (Gruppen haben ohnehin keine Anzahlung/
// Online-Zahlung, der Betrag ist rein informativ für Statistik/Personal).
export function berechneGruppenBetrag(kinderAnzahl: number): number {
  return kinderAnzahl * gruppenPreisProKind(kinderAnzahl)
}
