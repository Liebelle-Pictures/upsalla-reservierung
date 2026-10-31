// Anzeige der DSGVO-Grundlage in der Kundenakte (Dashboard).
// Online angelegte Kunden geben keine Einwilligung ab: die Verarbeitung beruht auf dem Vertrag
// (Art. 6 Abs. 1 lit. b DSGVO), deshalb dsgvo_einwilligung = false. Das soll nicht wie eine
// fehlende Einwilligung aussehen. „Online angelegt“ = die erste Reservierung des Kunden kam online.

export function dsgvoAnzeige(dsgvoEinwilligung: boolean, ersteReservierungQuelle: string | null): string {
  if (dsgvoEinwilligung) return '✓ Einwilligung erteilt'
  if (ersteReservierungQuelle === 'ONLINE') return 'Online-Buchung (Vertrag)'
  return '✗ Nicht erteilt'
}
