// Verfügbarkeit der Logen — gemeinsame Logik für Lena (api/lena/verfuegbarkeit) und die
// Online-Buchung (api/buchen/[standort]/...). Siehe docs/module/online-buchung.md, 5.2.
//
// Zwei Modi:
//   - LENA:   exakt das bisherige Verhalten der Lena-Route (darf sich nicht ändern).
//   - ONLINE: exakt die Regeln der DB-Funktion reserviere_online (Migration 011). Sonst zeigt
//             das Widget einen Slot als frei an, den die Funktion danach ablehnt.
//             Unterschiede zu LENA:
//               * nur Logen mit online_buchbar = true (Gruppen fällt weg)
//               * INTERN_GESPERRT im Slot blockiert die Loge komplett (egal wie viele Kinder)
//               * abgelaufene, unbezahlte Online-Holds zählen nicht als belegt
//               * flexible Logen (BBQ Zelt): Obergrenze max_kinder statt "kein Deckel"
//               * halb belegte Loge: zweite Gruppe höchstens 9 Kinder (≥10 lehnt die Funktion ab)
//             Die Online-Variante darf strenger sein als die Funktion (z.B. verfuegbarkeit_regel,
//             Mindestrest 6), aber nie großzügiger.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { getVerfuegbareSlots, logeIstVerfuegbarFuerSlot, istGeschlossen, type ZeitslotInfo } from '@/lib/utils/zeitslots'
import { istPreisteuerterTag, getPreisTypLabel, ladePreisteuerteTage } from '@/lib/utils/feiertage'

export type VerfuegbarkeitsModus = 'LENA' | 'ONLINE'

export interface LogeZeile {
  id: string
  name: string
  ist_babywelt: boolean
  kapazitaet_flexibel: boolean
  verfuegbarkeit_regel: string | null
  max_kinder: number
  online_buchbar: boolean
}

export interface BelegungZeile {
  loge_id: string
  zeitslot: number
  kinder_anzahl: number
  status: string
  angenommen_von: string | null
  online_hold_bis: string | null
}

export interface BelegungMitDatum extends BelegungZeile {
  datum: string
}

// Feldreihenfolge = JSON-Reihenfolge der Lena-Antwort, NICHT ändern
export interface VerfuegbarSlot {
  loge_id: string
  loge_name: string
  ist_babywelt: boolean
  zeitslot: number
  uhrzeit: string
  teil_belegt: boolean
  bereits_kinder?: number
  max_kinder: number | null
}

// Kleinster Rest, ab dem eine halb belegte Loge noch angeboten wird
const MINDEST_REST_KINDER = 6
// Ab dieser Kinderzahl belegt eine Gruppe die Loge exklusiv
const EXKLUSIV_AB_KINDER = 10
// Gleicher Fallback wie bisher in der Lena-Route
const STANDARD_KAPAZITAET = 16

const LOGEN_SPALTEN = 'id, name, ist_babywelt, kapazitaet_flexibel, verfuegbarkeit_regel, max_kinder, online_buchbar'
const BELEGUNG_SPALTEN = 'loge_id, zeitslot, kinder_anzahl, status, angenommen_von, online_hold_bis'

// Wie in reserviere_online: unbezahlter Online-Hold, dessen Frist abgelaufen ist
export function istAbgelaufenerOnlineHold(r: BelegungZeile, jetzt: Date): boolean {
  return r.angenommen_von === 'ONLINE'
    && r.status === 'BESTAETIGT_AUSSTEHEND'
    && r.online_hold_bis !== null
    && new Date(r.online_hold_bis).getTime() < jetzt.getTime()
}

// Reine Funktion (ohne DB) — berechnet die freien Loge/Slot-Kombinationen eines Tages.
// belegungen: alle Reservierungen des Tages mit status <> 'STORNIERT'.
export function berechneFreieSlots(
  datumObj: Date,
  teuerterTag: boolean,
  logen: LogeZeile[],
  belegungen: BelegungZeile[],
  modus: VerfuegbarkeitsModus,
  jetzt: Date = new Date(),
): VerfuegbarSlot[] {
  const online = modus === 'ONLINE'

  // Belegungen pro Slot aggregieren
  const belegMap = new Map<string, { anzahl: number; kinder: number; intern: boolean }>()
  for (const r of belegungen) {
    if (online && istAbgelaufenerOnlineHold(r, jetzt)) continue
    const key = `${r.loge_id}-${r.zeitslot}`
    const b = belegMap.get(key) ?? { anzahl: 0, kinder: 0, intern: false }
    belegMap.set(key, { anzahl: b.anzahl + 1, kinder: b.kinder + r.kinder_anzahl, intern: b.intern || r.status === 'INTERN_GESPERRT' })
  }

  const slots = getVerfuegbareSlots(datumObj, teuerterTag)
  const relevanteLogen = online ? logen.filter(l => l.online_buchbar) : logen

  return relevanteLogen.flatMap(loge =>
    slots.flatMap((s: ZeitslotInfo): VerfuegbarSlot[] => {
      // Loge-spezifische Verfügbarkeitsregel (z.B. Runde Tische unten: am Wochenende nur vormittags)
      if (!logeIstVerfuegbarFuerSlot(loge.verfuegbarkeit_regel, datumObj, s.nummer)) return []

      const key = `${loge.id}-${s.nummer}`
      const b = belegMap.get(key)
      const kapazitaet = loge.max_kinder ?? STANDARD_KAPAZITAET
      const basis = { loge_id: loge.id, loge_name: loge.name, ist_babywelt: loge.ist_babywelt, zeitslot: s.nummer, uhrzeit: `${s.start} - ${s.ende} Uhr` }

      // Online: interne Sperrung blockiert die Loge komplett
      if (online && b?.intern) return []

      // Flexible Kapazität (z.B. BBQ Zelt): nur eine Gruppe; Lena ohne festen Deckel, online max_kinder
      if (loge.kapazitaet_flexibel) {
        if (b && b.anzahl >= 1) return []
        return [{ ...basis, teil_belegt: false, max_kinder: online ? kapazitaet : null }]
      }

      // Vollständig frei
      if (!b) return [{ ...basis, teil_belegt: false, max_kinder: kapazitaet }]

      // Bereits 2 Gruppen oder exklusive Gruppe (≥10 Kinder) → voll belegt
      if (b.anzahl >= 2 || b.kinder >= EXKLUSIV_AB_KINDER) return []

      // Halbe Loge frei (erste Gruppe hat <10 Kinder, Platz für 2. Gruppe)
      const rest = kapazitaet - b.kinder
      if (rest < MINDEST_REST_KINDER) return []
      const maxWeitere = online ? Math.min(rest, EXKLUSIV_AB_KINDER - 1) : rest
      return [{ ...basis, teil_belegt: true, bereits_kinder: b.kinder, max_kinder: maxWeitere }]
    }),
  )
}

async function ladeLogen(standortId: string): Promise<LogeZeile[]> {
  const { data, error } = await supabaseAdmin
    .from('logen')
    .select(LOGEN_SPALTEN)
    .eq('standort_id', standortId)
    .eq('aktiv', true)
    .order('name')
  if (error) console.error('[verfuegbarkeit] Logen laden fehlgeschlagen:', error.message)
  return (data as LogeZeile[] | null) ?? []
}

export interface VerfuegbarkeitsErgebnis {
  datum: string
  geschlossen: boolean
  teuerterTag: boolean
  preisTyp: string
  verfuegbar: VerfuegbarSlot[]
}

// datum: 'YYYY-MM-DD' (bereits normalisiert)
export async function berechneVerfuegbarkeit(params: {
  standortId: string
  datum: string
  modus: VerfuegbarkeitsModus
  jetzt?: Date
}): Promise<VerfuegbarkeitsErgebnis> {
  const { standortId, datum, modus, jetzt } = params
  const datumObj = new Date(datum + 'T00:00:00')

  if (istGeschlossen(datumObj)) {
    return { datum, geschlossen: true, teuerterTag: false, preisTyp: '', verfuegbar: [] }
  }

  // Preistyp und verfügbare Slots ermitteln (inkl. Feiertage/Ferien)
  const [teuerterTag, preisTyp] = await Promise.all([
    istPreisteuerterTag(datumObj),
    getPreisTypLabel(datumObj),
  ])

  const logen = await ladeLogen(standortId)

  const { data: belegt, error } = await supabaseAdmin
    .from('reservierungen')
    .select(BELEGUNG_SPALTEN)
    .eq('datum', datum)
    .eq('standort_id', standortId)
    .neq('status', 'STORNIERT')
  if (error) console.error('[verfuegbarkeit] Belegung laden fehlgeschlagen:', error.message)

  const verfuegbar = berechneFreieSlots(datumObj, teuerterTag, logen, (belegt as BelegungZeile[] | null) ?? [], modus, jetzt)
  return { datum, geschlossen: false, teuerterTag, preisTyp, verfuegbar }
}

// ─── Monatsübersicht (nur online) ─────────────────────────────────────────────

export type TagesStatus = 'geschlossen' | 'ausgebucht' | 'wenige' | 'frei'

export interface MonatsTag {
  datum: string
  status: TagesStatus
  wochenendpreis: boolean
}

// "wenige" = höchstens so viele freie Loge/Slot-Kombinationen
export const WENIGE_GRENZE = 2

export function tagesStatus(freieKombinationen: number, geschlossen: boolean): TagesStatus {
  if (geschlossen) return 'geschlossen'
  if (freieKombinationen === 0) return 'ausgebucht'
  if (freieKombinationen <= WENIGE_GRENZE) return 'wenige'
  return 'frei'
}

// monat: 'YYYY-MM'. Eine Abfrage für die Logen, eine für alle Reservierungen des Monats,
// eine für die Schulferien (Wochenendpreis). Regeln = ONLINE (wie reserviere_online).
export async function berechneMonatsuebersicht(standortId: string, monat: string, jetzt: Date = new Date()): Promise<MonatsTag[]> {
  const [jahr, mon] = monat.split('-').map(Number)
  const tageImMonat = new Date(jahr, mon, 0).getDate()
  const von = `${monat}-01`
  const bis = `${monat}-${String(tageImMonat).padStart(2, '0')}`

  const [logen, belegungRes, teureTage] = await Promise.all([
    ladeLogen(standortId),
    supabaseAdmin
      .from('reservierungen')
      .select('datum, ' + BELEGUNG_SPALTEN)
      .eq('standort_id', standortId)
      .gte('datum', von)
      .lte('datum', bis)
      .neq('status', 'STORNIERT')
      .limit(5000),
    ladePreisteuerteTage(von, bis),
  ])
  if (belegungRes.error) console.error('[verfuegbarkeit] Monatsbelegung laden fehlgeschlagen:', belegungRes.error.message)

  const proTag = new Map<string, BelegungZeile[]>()
  for (const r of (belegungRes.data as unknown as BelegungMitDatum[] | null) ?? []) {
    const liste = proTag.get(r.datum) ?? []
    liste.push(r)
    proTag.set(r.datum, liste)
  }

  const ergebnis: MonatsTag[] = []
  for (let tag = 1; tag <= tageImMonat; tag++) {
    const datum = `${monat}-${String(tag).padStart(2, '0')}`
    const datumObj = new Date(datum + 'T00:00:00')
    const teuer = teureTage.has(datum)
    const geschlossen = istGeschlossen(datumObj)
    const frei = geschlossen ? 0 : berechneFreieSlots(datumObj, teuer, logen, proTag.get(datum) ?? [], 'ONLINE', jetzt).length
    ergebnis.push({ datum, status: tagesStatus(frei, geschlossen), wochenendpreis: teuer })
  }
  return ergebnis
}
