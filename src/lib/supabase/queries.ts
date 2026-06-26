import { supabaseAdmin } from './admin'
import type { Loge } from '@/types/loge'
import type { Reservierung } from '@/types/reservierung'

export interface Kunde {
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

export async function getLoge(id: string): Promise<Loge | null> {
  const { data } = await supabaseAdmin
    .from('logen')
    .select('*')
    .eq('id', id)
    .single()
  return data as unknown as Loge | null
}

export async function getAlleKunden(standortId: string, suche?: string) {
  let query = supabaseAdmin
    .from('kunden')
    .select('id, vorname, nachname, telefon, email, kind_geburtstag, anzahl_besuche, gesamtumsatz, erstellt_am')
    .eq('standort_id', standortId)
    .order('nachname', { ascending: true })

  if (suche) {
    query = query.or(`vorname.ilike.%${suche}%,nachname.ilike.%${suche}%,telefon.ilike.%${suche}%`)
  }

  const { data } = await query
  return data ?? []
}

export async function getKunde(id: string): Promise<Kunde | null> {
  const { data } = await supabaseAdmin
    .from('kunden')
    .select('*')
    .eq('id', id)
    .single()
  return data as unknown as Kunde | null
}

export interface ReservierungKurzinfo {
  id: string
  datum: string
  zeitslot: number
  status: string
  typ: string
  kinder_anzahl: number
  gesamtbetrag: number
  logen: { name: string } | null
}

export async function getReservierungenFuerKunde(kundeId: string): Promise<ReservierungKurzinfo[]> {
  const { data } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, status, typ, kinder_anzahl, gesamtbetrag, logen(name)')
    .eq('kunde_id', kundeId)
    .order('datum', { ascending: false })
  return (data ?? []) as unknown as ReservierungKurzinfo[]
}

export async function getReservierungenMitDetails(datum: string, standortId: string) {
  const { data } = await supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, status, typ, kinder_anzahl, erwachsene_anzahl, gesamtbetrag, anzahlung_betrag, notizen, logen(name), kunden(vorname, nachname, telefon)')
    .eq('datum', datum)
    .eq('standort_id', standortId)
    .neq('status', 'STORNIERT')
    .order('zeitslot', { ascending: true })
    .order('logen(name)', { ascending: true })
  return data ?? []
}

export async function getAlleReservierungen(standortId: string, status?: string) {
  let query = supabaseAdmin
    .from('reservierungen')
    .select('id, datum, zeitslot, status, typ, kinder_anzahl, gesamtbetrag, anzahlung_betrag, logen(name), kunden(vorname, nachname, telefon)')
    .eq('standort_id', standortId)
    .order('datum', { ascending: false })
    .order('zeitslot', { ascending: true })

  if (status && status !== 'ALLE') {
    query = query.eq('status', status)
  }

  const { data } = await query
  return data ?? []
}

export async function getReservierung(id: string) {
  const { data } = await supabaseAdmin
    .from('reservierungen')
    .select('*, kunden(*), logen(name), standorte(name)')
    .eq('id', id)
    .single()
  return data
}

export async function getLogen(standortId: string): Promise<Loge[]> {
  const { data, error } = await supabaseAdmin
    .from('logen')
    .select('*')
    .eq('standort_id', standortId)
    .eq('aktiv', true)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Loge[]
}

export async function getReservierungenFuerMonat(
  jahr: number,
  monat: number,
  standortId: string,
): Promise<{ datum: string; status: string }[]> {
  const von = `${jahr}-${String(monat).padStart(2, '0')}-01`
  const bis = new Date(jahr, monat, 0).toISOString().slice(0, 10) // letzter Tag
  const { data } = await supabaseAdmin
    .from('reservierungen')
    .select('datum, status')
    .eq('standort_id', standortId)
    .gte('datum', von)
    .lte('datum', bis)
    .neq('status', 'STORNIERT')
  return (data ?? []) as { datum: string; status: string }[]
}

export async function getReservierungenFuerTag(
  datum: string,
  standortId: string,
): Promise<Reservierung[]> {
  const { data, error } = await supabaseAdmin
    .from('reservierungen')
    .select('*, kunden(vorname, nachname)')
    .eq('datum', datum)
    .eq('standort_id', standortId)
    .neq('status', 'STORNIERT')

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Reservierung[]
}
