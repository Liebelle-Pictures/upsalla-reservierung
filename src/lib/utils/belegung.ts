// Belegungsregel der Logen (ohne DB, auch im Browser nutzbar) — siehe docs/module/online-buchung.md, 10.
// Eine Gruppe belegt eine (feste) Loge exklusiv, wenn sie 10+ Kinder hat ODER „ganze Loge“ gebucht hat.
// Gilt überall, wo Belegung berechnet wird: reserviere_online, verfuegbarkeit.ts (LENA + ONLINE),
// Lena reservieren/ändern, Personal-Formular, Kalender.
import { GANZE_LOGE_MIN_KINDER } from './preise'

// Ab dieser Kinderzahl belegt eine Gruppe die Loge exklusiv
export const EXKLUSIV_AB_KINDER = GANZE_LOGE_MIN_KINDER

export function istExklusiveBelegung(r: { kinder_anzahl: number; ganze_loge?: boolean | null }): boolean {
  return r.kinder_anzahl >= EXKLUSIV_AB_KINDER || r.ganze_loge === true
}

// Belegungsprüfung des Personal-Formulars (reservierungErstellen), als reine Funktion testbar
// (scripts/test-ganze-loge.ts). belegungen = aktive Reservierungen im Slot (ohne STORNIERT).
// Gibt den Fehlertext zurück oder null, wenn die neue Gruppe passt.
export function pruefePersonalBelegung(
  belegungen: Array<{ kinder_anzahl: number; ganze_loge?: boolean | null }>,
  neu: { kinderAnzahl: number; ganzeLoge: boolean; flexibel: boolean; maxKinder: number },
): string | null {
  const bereitsKinder = belegungen.reduce((s, r) => s + r.kinder_anzahl, 0)
  if (neu.flexibel) {
    // z.B. BBQ Zelt: keine feste Obergrenze, aber nur eine Gruppe gleichzeitig
    return belegungen.length >= 1 ? 'Dieser Slot ist bereits belegt.' : null
  }
  if (belegungen.length >= 2) return 'Dieser Slot ist bereits mit zwei Gruppen belegt.'
  if (neu.ganzeLoge && belegungen.length >= 1) return 'Ganze Loge nicht möglich: In diesem Slot feiert schon eine andere Gruppe.'
  if (belegungen.length === 1) {
    if (istExklusiveBelegung(belegungen[0])) {
      return belegungen[0].ganze_loge
        ? 'Diese Loge ist für diesen Slot exklusiv belegt (ganze Loge gebucht).'
        : 'Diese Loge ist für diesen Slot exklusiv belegt (10+ Kinder).'
    }
    if (neu.kinderAnzahl >= EXKLUSIV_AB_KINDER) {
      return `In dieser Loge gibt es bereits eine Gruppe mit ${belegungen[0].kinder_anzahl} Kindern. Exklusive Buchung nicht möglich.`
    }
    if (bereitsKinder + neu.kinderAnzahl > neu.maxKinder) {
      return `In dieser Loge sind bereits ${bereitsKinder} Kinder gebucht. Maximal ${neu.maxKinder - bereitsKinder} weitere möglich.`
    }
  }
  if (belegungen.length === 0 && neu.kinderAnzahl > neu.maxKinder) return `Diese Loge fasst maximal ${neu.maxKinder} Kinder.`
  return null
}
