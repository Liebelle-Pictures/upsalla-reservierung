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

export interface LenaStatistik {
  reservierungenGesamt: number
  anzahlungErhalten: number
  conversionRate: number
  gesicherterUmsatz: number       // Gesamtbetrag aller bezahlten Lena-Reservierungen
  einsparungPotenzial: number     // Gesamtbetrag aller Lena-Reservierungen (auch ausstehend)
  stornierungen: number
}

export async function getLenaStatistik(
  zeitraum: 'heute' | 'woche' | 'monat',
  standortId: string,
): Promise<LenaStatistik> {
  const jetzt = new Date()

  let von: string
  if (zeitraum === 'heute') {
    von = jetzt.toISOString().slice(0, 10) + 'T00:00:00.000Z'
  } else if (zeitraum === 'woche') {
    const wochenstart = new Date(jetzt)
    const tag = wochenstart.getDay()
    const diff = tag === 0 ? -6 : 1 - tag // Montag = Wochenstart
    wochenstart.setDate(wochenstart.getDate() + diff)
    wochenstart.setHours(0, 0, 0, 0)
    von = wochenstart.toISOString()
  } else {
    von = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from('reservierungen')
    .select('status, gesamtbetrag')
    .eq('standort_id', standortId)
    .is('erstellt_von', null)   // Lena setzt keinen Supabase-User
    .gte('erstellt_am', von)

  const alle = (data ?? []) as { status: string; gesamtbetrag: number }[]
  const aktive = alle.filter(r => r.status !== 'STORNIERT')
  const bezahlt = alle.filter(r => r.status === 'BESTAETIGT_BEZAHLT')
  const storniert = alle.filter(r => r.status === 'STORNIERT')

  return {
    reservierungenGesamt: aktive.length,
    anzahlungErhalten: bezahlt.length,
    conversionRate: aktive.length > 0 ? (bezahlt.length / aktive.length) * 100 : 0,
    gesicherterUmsatz: bezahlt.reduce((s, r) => s + Number(r.gesamtbetrag), 0),
    einsparungPotenzial: aktive.reduce((s, r) => s + Number(r.gesamtbetrag), 0),
    stornierungen: storniert.length,
  }
}

export interface AnrufeStatistik {
  gesamt: number
  erfolgreich: number      // Anruf mit Reservierung
  voicemail: number
  conversionRate: number
  durchschnittsDauer: number  // Sekunden
}

export async function getAnrufeStatistik(
  zeitraum: 'heute' | 'woche' | 'monat',
): Promise<AnrufeStatistik> {
  const jetzt = new Date()
  let von: string

  if (zeitraum === 'heute') {
    von = jetzt.toISOString().slice(0, 10)
  } else if (zeitraum === 'woche') {
    const d = new Date(jetzt)
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
    d.setDate(d.getDate() + diff)
    von = d.toISOString().slice(0, 10)
  } else {
    von = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-01`
  }

  const { data } = await supabaseAdmin
    .from('lena_anrufe')
    .select('reservierung_erstellt, in_voicemail, dauer_sekunden')
    .gte('datum', von)

  const alle = data ?? []
  const mitReservierung = alle.filter(a => a.reservierung_erstellt)
  const voicemail = alle.filter(a => a.in_voicemail)
  const gespraeche = alle.filter(a => !a.in_voicemail)
  const gesamtDauer = gespraeche.reduce((s, a) => s + (a.dauer_sekunden ?? 0), 0)

  return {
    gesamt: alle.length,
    erfolgreich: mitReservierung.length,
    voicemail: voicemail.length,
    conversionRate: gespraeche.length > 0 ? (mitReservierung.length / gespraeche.length) * 100 : 0,
    durchschnittsDauer: gespraeche.length > 0 ? Math.round(gesamtDauer / gespraeche.length) : 0,
  }
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
