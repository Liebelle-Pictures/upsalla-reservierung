'use client'
// Buchungs-Widget /buchen/[standort]: 5 Schritte, danach Weiterleitung zu Stripe Checkout.
// Daten nur über die öffentliche API (/api/buchen/[standort]/…), Preise rechnet verbindlich
// der Server. Siehe docs/module/online-buchung.md, 5.6.
//
// Browser-Verlauf: jeder Schritt vorwärts ist ein Eintrag, damit „Zurück“ am Handy einen
// Schritt zurückgeht statt die Seite zu verlassen.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Fortschritt } from './Fortschritt'
import { SchrittDatum } from './SchrittDatum'
import { SchrittLoge } from './SchrittLoge'
import { SchrittPersonen } from './SchrittPersonen'
import { SchrittKontakt } from './SchrittKontakt'
import { SchrittUebersicht } from './SchrittUebersicht'
import { Aktionsleiste, Hinweis, Knopf } from './ui'
import {
  begrenze, euro, LEERER_KONTAKT, maxKinderFuerLoge, preisVorschau, pruefeKontakt, reaktionAufAntwort,
  type Kontakt, type KontaktFehler, type MonatAntwort, type Schritt, type TagAntwort,
} from './wizardLogik'

const LADEFEHLER = 'Die freien Termine konnten gerade nicht geladen werden. Bitte prüft eure Internetverbindung.'
const MAX_WIEDERHOLUNGEN = 5
const WIEDERHOLEN_NACH_MS = 2000

type HinweisTon = 'info' | 'warnung' | 'fehler'
interface SchrittHinweis { schritt: Schritt; ton: HinweisTon; text: string }

// crypto.randomUUID gibt es nur in sicheren Kontexten (https/localhost)
function neueUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

async function ladeJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export function BuchungsWizard({ slug, ersterMonat, letzterMonat }: { slug: string; ersterMonat: string; letzterMonat: string }) {
  const api = `/api/buchen/${encodeURIComponent(slug)}`

  const [schritt, setSchritt] = useState<Schritt>(1)
  // Ein Schlüssel pro Wizard-Durchlauf (Schutz gegen doppeltes Absenden). Nur im Browser benutzt.
  const [schluessel, setSchluessel] = useState<string>(() => neueUuid())

  // Schritt 1
  const [monat, setMonat] = useState(ersterMonat)
  const [monate, setMonate] = useState<Record<string, MonatAntwort>>({})
  const [monatFehler, setMonatFehler] = useState<string | null>(null)
  const [datum, setDatum] = useState<string | null>(null)

  // Schritt 2
  const [tag, setTag] = useState<TagAntwort | null>(null)
  const [tagLaedt, setTagLaedt] = useState(false)
  const [tagFehler, setTagFehler] = useState<string | null>(null)
  const [zeitslot, setZeitslot] = useState<number | null>(null)
  const [logeId, setLogeId] = useState<string | null>(null)

  // Schritt 3–5
  const [kinder, setKinder] = useState(6)
  const [erwachsene, setErwachsene] = useState(2)
  const [kontakt, setKontakt] = useState<Kontakt>(LEERER_KONTAKT)
  const [kontaktFehler, setKontaktFehler] = useState<KontaktFehler>({})
  const [hinweis, setHinweis] = useState<SchrittHinweis | null>(null)
  const [sendet, setSendet] = useState(false)
  const [abgeschlossen, setAbgeschlossen] = useState(false)

  const inhaltRef = useRef<HTMLDivElement>(null)
  const tagAnfrage = useRef<AbortController | null>(null)

  // ─── Abgeleitete Auswahl ───────────────────────────────────────────────────────
  const slot = tag?.slots.find(s => s.zeitslot === zeitslot) ?? null
  const loge = slot?.logen.find(l => l.loge_id === logeId) ?? null
  const maxKinder = loge ? maxKinderFuerLoge(loge) : 1
  const wochenendpreis = tag?.wochenendpreis ?? false
  const kontaktOk = Object.keys(pruefeKontakt(kontakt)).length === 0
  // Weiter als die Auswahl erlaubt geht es nicht (z. B. Vorwärts-Taste im Browser)
  const erreichbar: Schritt = !datum ? 1 : !loge ? 2 : !kontaktOk ? 4 : 5
  const aktuell = Math.min(schritt, erreichbar) as Schritt

  // ─── Idempotenz-Schlüssel + Browser-Verlauf ────────────────────────────────────
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, buchenSchritt: 1 }, '')
    const beiPop = (e: PopStateEvent) => {
      const s = (e.state as { buchenSchritt?: Schritt } | null)?.buchenSchritt
      setSchritt(s ?? 1)
    }
    // Zurück von Stripe (bfcache): Knopf wieder freigeben
    const beiPageshow = (e: PageTransitionEvent) => { if (e.persisted) setSendet(false) }
    window.addEventListener('popstate', beiPop)
    window.addEventListener('pageshow', beiPageshow)
    return () => {
      window.removeEventListener('popstate', beiPop)
      window.removeEventListener('pageshow', beiPageshow)
    }
  }, [])

  // Bei Schrittwechsel nach oben und Fokus auf den Inhalt (Screenreader liest den neuen Titel)
  const ersterRender = useRef(true)
  useEffect(() => {
    if (ersterRender.current) { ersterRender.current = false; return }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    inhaltRef.current?.focus({ preventScroll: true })
  }, [aktuell])

  const vor = useCallback((ziel: Schritt) => {
    setSchritt(ziel)
    window.history.pushState({ ...window.history.state, buchenSchritt: ziel }, '')
  }, [])

  // Zurück immer über den Verlauf, damit Knopf und Browser-Zurück dasselbe tun
  const zurueck = useCallback((ziel: Schritt) => {
    const differenz = aktuell - ziel
    if (differenz <= 0) return
    const imVerlauf = (window.history.state as { buchenSchritt?: Schritt } | null)?.buchenSchritt === aktuell
    if (imVerlauf) window.history.go(-differenz)
    else vor(ziel)
  }, [aktuell, vor])

  // ─── Daten laden ───────────────────────────────────────────────────────────────
  // Monatsdaten laden, sobald ein Monat ohne Daten angezeigt wird. monatVersuch erhöht
  // „Erneut versuchen“ (lädt denselben Monat nochmal).
  const [monatVersuch, setMonatVersuch] = useState(0)
  useEffect(() => {
    if (monate[monat]) return
    const ctrl = new AbortController()
    ladeJson<MonatAntwort>(`${api}/monat?monat=${monat}`, ctrl.signal).then(
      daten => setMonate(alt => ({ ...alt, [monat]: daten })),
      (e: Error) => { if (e.name !== 'AbortError') setMonatFehler(LADEFEHLER) },
    )
    return () => ctrl.abort()
  }, [api, monat, monate, monatVersuch])

  const ladeTag = useCallback(async (d: string) => {
    tagAnfrage.current?.abort()
    const ctrl = new AbortController()
    tagAnfrage.current = ctrl
    setTagLaedt(true)
    setTagFehler(null)
    try {
      const daten = await ladeJson<TagAntwort>(`${api}/tag?datum=${d}`, ctrl.signal)
      setTag(daten)
      // Nur eine Uhrzeit mit freien Logen → direkt auswählen
      const mitPlatz = daten.slots.filter(s => s.logen.length > 0)
      setZeitslot(alt => {
        if (alt !== null && mitPlatz.some(s => s.zeitslot === alt)) return alt
        return mitPlatz.length === 1 ? mitPlatz[0].zeitslot : null
      })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setTagFehler(LADEFEHLER)
    } finally {
      if (tagAnfrage.current === ctrl) setTagLaedt(false)
    }
  }, [api])

  // ─── Auswahl ───────────────────────────────────────────────────────────────────
  function waehleDatum(d: string) {
    if (d !== datum) {
      setDatum(d)
      setTag(null)
      setZeitslot(null)
      setLogeId(null)
      void ladeTag(d)
    }
    setHinweis(null)
    vor(2)
  }

  function waehleSlot(s: number) {
    if (s !== zeitslot) setLogeId(null)
    setZeitslot(s)
  }

  function waehleLoge(id: string) {
    const l = slot?.logen.find(x => x.loge_id === id)
    if (!l) return
    setLogeId(id)
    setKinder(k => begrenze(k, 1, maxKinderFuerLoge(l)))
    setHinweis(null)
    vor(3)
  }

  function weiterVonKontakt() {
    const fehler = pruefeKontakt(kontakt)
    setKontaktFehler(fehler)
    const erstes = Object.keys(fehler)[0]
    if (erstes) {
      document.getElementById(erstes)?.focus()
      return
    }
    vor(5)
  }

  function aendereKontakt(teil: Partial<Kontakt>) {
    setKontakt(k => ({ ...k, ...teil }))
    // Fehler eines Feldes verschwindet, sobald es geändert wird
    setKontaktFehler(f => {
      const neu = { ...f }
      for (const key of Object.keys(teil) as Array<keyof Kontakt>) delete neu[key]
      return neu
    })
  }

  // ─── Absenden ──────────────────────────────────────────────────────────────────
  async function absenden(versuch = 0) {
    if (!datum || !loge || !slot) return
    setSendet(true)
    if (versuch === 0) setHinweis(null)

    let status: number
    let body: unknown = null
    try {
      const res = await fetch(`${api}/reservieren`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datum,
          zeitslot: slot.zeitslot,
          loge_id: loge.loge_id,
          kinder_anzahl: kinder,
          erwachsene_anzahl: erwachsene,
          vorname: kontakt.vorname.trim(),
          nachname: kontakt.nachname.trim(),
          telefon: kontakt.telefon.trim(),
          email: kontakt.email.trim(),
          notizen: kontakt.notizen.trim() || null,
          agb_akzeptiert: kontakt.agb_akzeptiert,
          datenschutz_akzeptiert: kontakt.datenschutz_akzeptiert,
          newsletter_opt_in: kontakt.newsletter_opt_in,
          turnstile_token: null, // Phase 6
          idempotenz_schluessel: schluessel,
          website: kontakt.website,
        }),
      })
      status = res.status
      body = await res.json().catch(() => null)
    } catch {
      setHinweis({ schritt: 5, ton: 'fehler', text: 'Keine Verbindung. Bitte prüft euer Internet und tippt noch einmal auf „Zahlungspflichtig buchen“.' })
      setSendet(false)
      return
    }

    const r = reaktionAufAntwort(status, body)
    switch (r.art) {
      case 'weiterleiten':
        // Auch aus einem iframe auf upsalla-kinderpark.de heraus die ganze Seite wechseln
        try { window.top!.location.href = r.url } catch { window.location.href = r.url }
        return // Knopf bleibt gesperrt bis zur Weiterleitung
      case 'neuer_schluessel':
        setSchluessel(neueUuid())
        setHinweis({ schritt: 5, ton: 'warnung', text: r.hinweis })
        break
      case 'zurueck_zur_auswahl':
        setLogeId(null)
        setMonate(alt => { const neu = { ...alt }; delete neu[datum.slice(0, 7)]; return neu })
        void ladeTag(datum)
        setHinweis({ schritt: 2, ton: 'warnung', text: r.hinweis })
        zurueck(2)
        break
      case 'wiederholen':
        if (versuch < MAX_WIEDERHOLUNGEN) {
          setHinweis({ schritt: 5, ton: 'info', text: r.hinweis })
          setTimeout(() => void absenden(versuch + 1), WIEDERHOLEN_NACH_MS)
          return // Knopf bleibt gesperrt
        }
        setHinweis({ schritt: 5, ton: 'fehler', text: 'Das dauert gerade ungewöhnlich lange. Bitte versucht es in ein paar Minuten noch einmal.' })
        break
      case 'bereits_bezahlt':
        setAbgeschlossen(true)
        setHinweis({ schritt: 5, ton: 'info', text: r.hinweis })
        break
      case 'feld':
        if (r.schritt === 4 && r.feld) setKontaktFehler({ [r.feld]: r.hinweis })
        setHinweis({ schritt: r.schritt, ton: 'fehler', text: r.hinweis })
        zurueck(r.schritt)
        break
      case 'fehler':
        setHinweis({ schritt: 5, ton: 'fehler', text: r.hinweis })
        break
    }
    setSendet(false)
  }

  // ─── Darstellung ───────────────────────────────────────────────────────────────
  const anzahlung = preisVorschau(kinder, erwachsene, wochenendpreis).anzahlung
  const sichtbarerHinweis = hinweis && hinweis.schritt === aktuell && aktuell !== 2 ? hinweis : null

  return (
    <div>
      <Fortschritt schritt={aktuell} onSpringe={zurueck} />

      <div ref={inhaltRef} tabIndex={-1} className="outline-none">
        {sichtbarerHinweis && <Hinweis ton={sichtbarerHinweis.ton}>{sichtbarerHinweis.text}</Hinweis>}

        {aktuell === 1 && (
          <SchrittDatum
            monat={monat}
            ersterMonat={ersterMonat}
            letzterMonat={letzterMonat}
            daten={monate[monat] ?? null}
            laedt={!monate[monat] && !monatFehler}
            fehler={monatFehler}
            gewaehlt={datum}
            onMonat={m => { setMonatFehler(null); setMonat(m) }}
            onWaehle={waehleDatum}
            onNeuLaden={() => { setMonatFehler(null); setMonatVersuch(v => v + 1) }}
          />
        )}

        {aktuell === 2 && datum && (
          <SchrittLoge
            datum={datum}
            tag={tag}
            laedt={tagLaedt}
            fehler={tagFehler}
            hinweis={hinweis?.schritt === 2 ? hinweis.text : null}
            zeitslot={zeitslot}
            logeId={logeId}
            onSlot={waehleSlot}
            onLoge={waehleLoge}
            onDatumAendern={() => zurueck(1)}
            onNeuLaden={() => void ladeTag(datum)}
          />
        )}

        {aktuell === 3 && loge && (
          <SchrittPersonen
            loge={loge}
            maxKinder={maxKinder}
            kinder={kinder}
            erwachsene={erwachsene}
            wochenendpreis={wochenendpreis}
            preisProKind={tag?.preis_pro_kind}
            onKinder={n => setKinder(begrenze(n, 1, maxKinder))}
            onErwachsene={setErwachsene}
          />
        )}

        {aktuell === 4 && <SchrittKontakt kontakt={kontakt} fehler={kontaktFehler} onChange={aendereKontakt} />}

        {aktuell === 5 && datum && slot && loge && (
          <SchrittUebersicht
            datum={datum}
            slot={slot}
            loge={loge}
            kinder={kinder}
            erwachsene={erwachsene}
            wochenendpreis={wochenendpreis}
            kontakt={kontakt}
            onAendern={zurueck}
          />
        )}
      </div>

      {aktuell > 1 && (
        <Aktionsleiste>
          <Knopf art="text" className="px-2" onClick={() => zurueck((aktuell - 1) as Schritt)} disabled={sendet}>
            ‹ Zurück
          </Knopf>
          {aktuell === 2 && (
            <Knopf className="flex-1 sm:flex-none" disabled={!loge} onClick={() => vor(3)}>Weiter</Knopf>
          )}
          {aktuell === 3 && <Knopf className="flex-1 sm:flex-none" onClick={() => vor(4)}>Weiter</Knopf>}
          {aktuell === 4 && <Knopf className="flex-1 sm:flex-none" onClick={weiterVonKontakt}>Weiter zur Übersicht</Knopf>}
          {aktuell === 5 && (
            <Knopf className="flex-1 text-[15px] leading-tight sm:flex-none sm:text-base" disabled={sendet || abgeschlossen} onClick={() => void absenden()}>
              {sendet ? (
                <><span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden />Einen Moment…</>
              ) : (
                <>Zahlungspflichtig buchen – Anzahlung {euro(anzahlung)}</>
              )}
            </Knopf>
          )}
        </Aktionsleiste>
      )}
    </div>
  )
}
