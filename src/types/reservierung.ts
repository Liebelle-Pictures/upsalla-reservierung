export type ReservierungTyp =
  | 'GEBURTSTAG'
  | 'BABYWELT_GEBURTSTAG'
  | 'GRUPPE'
  | 'WILD_SIDE'
  | 'INTERN'

export type ReservierungStatus =
  | 'BESTAETIGT_BEZAHLT'   // Grün
  | 'BESTAETIGT_AUSSTEHEND' // Gelb
  | 'STORNIERT'             // Rot
  | 'GRUPPENANGEBOT'        // Blau
  | 'INTERN_GESPERRT'       // Grau

export interface Reservierung {
  id: string
  typ: ReservierungTyp
  status: ReservierungStatus
  standort_id: string
  loge_id: string
  datum: string          // ISO date YYYY-MM-DD
  zeitslot: 1 | 2
  kunde_id: string
  kinder_anzahl: number
  erwachsene_anzahl: number
  paket_preis_pro_kind: number
  gesamtbetrag: number
  anzahlung_betrag: number
  stripe_payment_link?: string
  stripe_payment_intent_id?: string
  notizen?: string
  erstellt_am: string
  aktualisiert_am: string
}

export interface ReservierungErstellen {
  typ: ReservierungTyp
  standort_id: string
  loge_id: string
  datum: string
  zeitslot: 1 | 2
  kunde_id: string
  kinder_anzahl: number
  erwachsene_anzahl: number
  notizen?: string
}
