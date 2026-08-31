export interface Loge {
  id: string
  name: string
  standort_id: string
  max_kinder: number       // 20
  tische_anzahl: number    // 2
  ist_babywelt: boolean
  aktiv: boolean
  kapazitaet_flexibel: boolean
  verfuegbarkeit_regel: string | null   // z.B. 'SA_SO_SLOT1' — null = normale Verfügbarkeit
}

export interface Zeitslot {
  nummer: 1 | 2
  start: string  // 'HH:MM'
  ende: string   // 'HH:MM'
  wochentage: ('MO' | 'DI' | 'MI' | 'DO' | 'FR' | 'SA' | 'SO' | 'FEIERTAG' | 'FERIEN')[]
}

export interface SlotVerfuegbarkeit {
  loge_id: string
  datum: string
  zeitslot: 1 | 2
  verfuegbar: boolean
  reservierung_id?: string
}
