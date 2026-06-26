export interface Kunde {
  id: string
  vorname: string
  nachname: string
  telefon: string
  email?: string
  kind_geburtstag?: string   // ISO date
  standort_id: string
  dsgvo_einwilligung: boolean
  newsletter_opt_in: boolean
  anzahl_besuche: number
  gesamtumsatz: number
  erstellt_am: string
  aktualisiert_am: string
}

export interface KundeErstellen {
  vorname: string
  nachname: string
  telefon: string
  email?: string
  kind_geburtstag?: string
  standort_id: string
  dsgvo_einwilligung: boolean
  newsletter_opt_in: boolean
}
