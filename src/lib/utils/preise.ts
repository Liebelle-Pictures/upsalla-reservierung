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

// „Ganze Loge reservieren“: eine Gruppe mit 1–9 Kindern bekommt die Loge exklusiv und zahlt
// mindestens für so viele Kinder (zum Preis des Tages). Ab dieser Zahl ist die Loge ohnehin exklusiv.
export const GANZE_LOGE_MIN_KINDER = 10

// Gilt „ganze Loge“ wirklich? Bei 10+ Kindern oder flexibler Loge (BBQ Zelt) gehört die Loge der
// Gruppe sowieso allein → ignorieren (gespeichert wird dann false, kein Aufpreis).
export function istGanzeLogeWirksam(gewuenscht: boolean, kinderAnzahl: number, kapazitaetFlexibel: boolean): boolean {
  return gewuenscht && !kapazitaetFlexibel && kinderAnzahl < GANZE_LOGE_MIN_KINDER
}

// Kinderzahl, mit der berechneGesamtbetrag rechnet (kinder_anzahl bleibt die echte Zahl)
export function abrechnungsKinder(kinderAnzahl: number, ganzeLoge: boolean): number {
  return ganzeLoge ? Math.max(kinderAnzahl, GANZE_LOGE_MIN_KINDER) : kinderAnzahl
}

// Gesamtbetrag einer Geburtstagsbuchung, ggf. mit „ganzer Loge“ (gleiche Formel wie immer)
export function berechneGeburtstagsBetrag(kinderAnzahl: number, istWochenende: boolean, erwachseneAnzahl: number, ganzeLoge: boolean): number {
  return berechneGesamtbetrag(abrechnungsKinder(kinderAnzahl, ganzeLoge), istWochenende, erwachseneAnzahl)
}

export function berechneAnzahlung(gesamtbetrag: number): number {
  return Math.round(gesamtbetrag * 0.2 * 100) / 100
}

export function berechneZahlendErwachsene(erwachseneAnzahl: number): number {
  return Math.max(0, erwachseneAnzahl - FREIE_BEGLEITPERSONEN)
}

// Gruppenpreise (Kitas/Schulen) — separat von den Geburtstagspreisen oben.
// Staffelpreis: ab X Kindern gilt Y€ PRO Kind (nicht nur für die zusätzlichen).
// Eine Gruppe ist erst ab 20 Kindern definiert — kommen weniger, wird trotzdem der Preis
// für 20 Kinder berechnet (bestätigt von Upsalla, 2026-09-18).
export const GRUPPEN_PREIS_AB_20 = 9.5
export const GRUPPEN_PREIS_AB_50 = 9.0
export const GRUPPEN_PREIS_AB_100 = 8.0
export const GRUPPEN_MINDEST_KINDER = 20
export const GRUPPEN_FREIE_ERWACHSENE_PRO_KINDER = 10 // 1 Erwachsener frei pro 10 Kinder
export const GRUPPEN_ERWACHSENE_PREIS = 6.5 // pro zahlendem Erwachsenen über die Freianzahl hinaus

// abrechenbareKinder: die tatsächliche Kinderzahl, mindestens aber 20 (Abrechnungs-Untergrenze).
export function gruppenAbrechenbareKinder(kinderAnzahl: number): number {
  return Math.max(kinderAnzahl, GRUPPEN_MINDEST_KINDER)
}

export function gruppenPreisProKind(kinderAnzahl: number): number {
  const abrechenbar = gruppenAbrechenbareKinder(kinderAnzahl)
  if (abrechenbar >= 100) return GRUPPEN_PREIS_AB_100
  if (abrechenbar >= 50) return GRUPPEN_PREIS_AB_50
  return GRUPPEN_PREIS_AB_20
}

// Freie Begleitpersonen richten sich nach der tatsächlichen Kinderzahl (reale Betreuungsquote),
// nicht nach der Abrechnungs-Untergrenze von 20.
export function berechneGruppenFreieErwachsene(kinderAnzahl: number): number {
  return Math.floor(kinderAnzahl / GRUPPEN_FREIE_ERWACHSENE_PRO_KINDER)
}

export function berechneGruppenZahlendErwachsene(kinderAnzahl: number, erwachseneAnzahl: number): number {
  return Math.max(0, erwachseneAnzahl - berechneGruppenFreieErwachsene(kinderAnzahl))
}

export function berechneGruppenBetrag(kinderAnzahl: number, erwachseneAnzahl = 0): number {
  const abrechenbareKinder = gruppenAbrechenbareKinder(kinderAnzahl)
  const kinderBetrag = abrechenbareKinder * gruppenPreisProKind(kinderAnzahl)
  const erwachseneBetrag = berechneGruppenZahlendErwachsene(kinderAnzahl, erwachseneAnzahl) * GRUPPEN_ERWACHSENE_PREIS
  return kinderBetrag + erwachseneBetrag
}
