// Server-seitige PDF-Generierung via React-PDF
// Inhalt: Uhrzeit, Loge, Name, Kinder, Erwachsene, Menü, Notizen, Anzahlungsstatus

import type { Reservierung } from '@/types'

interface Props {
  datum: string
  reservierungen: Reservierung[]
}

// TODO: React-PDF Document/Page/View implementieren
export function TagesuebersichtPDF({ datum, reservierungen }: Props) {
  void datum
  void reservierungen
  return null
}
