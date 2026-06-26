// Tipuri Supabase manuale — înlocuiește cu `npx supabase gen types typescript` când schema e stabilă

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      standorte: {
        Row: {
          id: string
          name: string
          adresse: string | null
          aktiv: boolean
          erstellt_am: string
        }
        Insert: {
          id?: string
          name: string
          adresse?: string | null
          aktiv?: boolean
          erstellt_am?: string
        }
        Update: {
          id?: string
          name?: string
          adresse?: string | null
          aktiv?: boolean
          erstellt_am?: string
        }
      }
      logen: {
        Row: {
          id: string
          standort_id: string
          name: string
          max_kinder: number
          tische_anzahl: number
          ist_babywelt: boolean
          aktiv: boolean
          erstellt_am: string
        }
        Insert: {
          id?: string
          standort_id: string
          name: string
          max_kinder?: number
          tische_anzahl?: number
          ist_babywelt?: boolean
          aktiv?: boolean
          erstellt_am?: string
        }
        Update: {
          id?: string
          standort_id?: string
          name?: string
          max_kinder?: number
          tische_anzahl?: number
          ist_babywelt?: boolean
          aktiv?: boolean
          erstellt_am?: string
        }
      }
      kunden: {
        Row: {
          id: string
          standort_id: string
          vorname: string
          nachname: string
          telefon: string
          email: string | null
          kind_geburtstag: string | null
          dsgvo_einwilligung: boolean
          newsletter_opt_in: boolean
          anzahl_besuche: number
          gesamtumsatz: number
          erstellt_am: string
        }
        Insert: {
          id?: string
          standort_id: string
          vorname: string
          nachname: string
          telefon: string
          email?: string | null
          kind_geburtstag?: string | null
          dsgvo_einwilligung?: boolean
          newsletter_opt_in?: boolean
          anzahl_besuche?: number
          gesamtumsatz?: number
          erstellt_am?: string
        }
        Update: {
          id?: string
          standort_id?: string
          vorname?: string
          nachname?: string
          telefon?: string
          email?: string | null
          kind_geburtstag?: string | null
          dsgvo_einwilligung?: boolean
          newsletter_opt_in?: boolean
          anzahl_besuche?: number
          gesamtumsatz?: number
          erstellt_am?: string
        }
      }
      reservierungen: {
        Row: {
          id: string
          standort_id: string
          loge_id: string
          kunde_id: string | null
          datum: string
          zeitslot: number
          typ: string
          status: string
          kinder_anzahl: number
          erwachsene_anzahl: number
          paket_preis_pro_kind: number
          gesamtbetrag: number
          anzahlung_betrag: number
          stripe_payment_link: string | null
          stripe_payment_intent_id: string | null
          notizen: string | null
          erstellt_am: string
          aktualisiert_am: string
        }
        Insert: {
          id?: string
          standort_id: string
          loge_id: string
          kunde_id?: string | null
          datum: string
          zeitslot: number
          typ: string
          status?: string
          kinder_anzahl: number
          erwachsene_anzahl?: number
          paket_preis_pro_kind: number
          gesamtbetrag: number
          anzahlung_betrag: number
          stripe_payment_link?: string | null
          stripe_payment_intent_id?: string | null
          notizen?: string | null
          erstellt_am?: string
          aktualisiert_am?: string
        }
        Update: {
          id?: string
          standort_id?: string
          loge_id?: string
          kunde_id?: string | null
          datum?: string
          zeitslot?: number
          typ?: string
          status?: string
          kinder_anzahl?: number
          erwachsene_anzahl?: number
          paket_preis_pro_kind?: number
          gesamtbetrag?: number
          anzahlung_betrag?: number
          stripe_payment_link?: string | null
          stripe_payment_intent_id?: string | null
          notizen?: string | null
          erstellt_am?: string
          aktualisiert_am?: string
        }
      }
    }
  }
}
