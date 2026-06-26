export type Benutzerrolle =
  | 'MITARBEITER'
  | 'MANAGER'
  | 'DIREKTOR'
  | 'KI_LENA'

export interface Benutzer {
  id: string
  email: string
  rolle: Benutzerrolle
  standort_id?: string   // null für DIREKTOR
  aktiv: boolean
}
