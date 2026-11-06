// Schritt 3: Uhrzeit wählen, dann eine freie Loge. Gezeigt werden nur Logen, in die eure
// Kinderzahl passt (max_kinder kommt vom Server, Regeln wie reserviere_online). Das Etikett
// sagt, ob ihr die ganze Loge habt oder euren eigenen Tisch. Bei 1–9 Kindern in einer leeren
// Loge kann die ganze Loge dazugebucht werden (Aufpreis wie der Server rechnet).
import {
  aufpreisGanzeLoge, datumLang, etikettText, euro, ganzeLogeAngeboten, logenEtikett, passtFuerKinder, slotBezeichnung,
  textGanzeLogeOption, TEXT_REGEL_GANZ, TEXT_REGEL_TISCH, type LogenEtikett, type TagAntwort,
} from './wizardLogik'
import { GANZE_LOGE_MIN_KINDER } from '@/lib/utils/preise'
import { TELEFON_ANZEIGE, TELEFON_LINK } from '@/lib/online-buchung/konfiguration'
import { Haekchen } from './StatusSymbol'
import { GeteiltSymbol, LogenBild } from './LogenSymbol'
import { Hinweis, Karte, Knopf, Lader, SchrittTitel } from './ui'

function Etikett({ art }: { art: LogenEtikett }) {
  if (art === 'ganz') {
    return <span className="inline-flex whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-ups-gruen ring-1 ring-green-200">{etikettText(art)}</span>
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ups-creme px-2 py-0.5 text-xs font-bold text-[#6b4a00] ring-1 ring-ups-gelb/60">
      <GeteiltSymbol className="h-3.5 w-3.5 shrink-0" />{etikettText(art)}
    </span>
  )
}

// Die Regel einmal über der Liste, die zutreffende Hälfte hervorgehoben
function Regel({ kinder }: { kinder: number }) {
  const ab10 = kinder >= GANZE_LOGE_MIN_KINDER
  const kasten = (aktiv: boolean) => `rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ring-2 ${
    aktiv ? 'bg-ups-eis font-bold text-ups-navy ring-ups-blau' : 'bg-white font-semibold text-gray-500 ring-ups-hell'
  }`
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-2" role="note" aria-label="So werden die Logen vergeben">
      <p className={kasten(!ab10)}>{TEXT_REGEL_TISCH}</p>
      <p className={kasten(ab10)}>{TEXT_REGEL_GANZ}</p>
    </div>
  )
}

export function SchrittLoge({
  datum, tag, laedt, fehler, hinweis, zeitslot, logeId, kinder, erwachsene, ganzeLoge,
  onSlot, onLoge, onGanzeLoge, onDatumAendern, onKinderAendern, onNeuLaden,
}: {
  datum: string
  tag: TagAntwort | null
  laedt: boolean
  fehler: string | null
  hinweis: string | null
  zeitslot: number | null
  logeId: string | null
  kinder: number
  erwachsene: number
  ganzeLoge: boolean
  onSlot: (zeitslot: number) => void
  onLoge: (logeId: string) => void
  onGanzeLoge: (an: boolean) => void
  onDatumAendern: () => void
  onKinderAendern: () => void
  onNeuLaden: () => void
}) {
  // Nur Logen, in die eure Kinderzahl passt
  const slots = (tag?.slots ?? []).map(s => ({ ...s, logen: s.logen.filter(l => passtFuerKinder(l, kinder)) }))
  const slot = slots.find(s => s.zeitslot === zeitslot) ?? null
  const passendFrei = slots.some(s => s.logen.length > 0)
  const aufpreis = aufpreisGanzeLoge(kinder, erwachsene, tag?.wochenendpreis ?? false)

  return (
    <>
      <SchrittTitel
        titel="Uhrzeit & Loge"
        untertitel={<>
          <span className="font-bold text-ups-navy">{datumLang(datum)}</span>{' · '}
          <button type="button" onClick={onDatumAendern} className="font-bold text-ups-blau underline underline-offset-4">ändern</button>
          <br />
          <span className="font-bold text-ups-navy">{kinder} {kinder === 1 ? 'Kind' : 'Kinder'}</span>{' · '}
          <button type="button" onClick={onKinderAendern} className="font-bold text-ups-blau underline underline-offset-4">ändern</button>
        </>}
      />
      {hinweis && <Hinweis ton="warnung">{hinweis}</Hinweis>}

      {fehler ? (
        <Karte>
          <Hinweis ton="fehler">{fehler}</Hinweis>
          <Knopf art="zweit" onClick={onNeuLaden}>Erneut versuchen</Knopf>
        </Karte>
      ) : laedt || !tag ? (
        <Karte><Lader text="Freie Logen werden geladen…" /></Karte>
      ) : !tag.buchbar ? (
        <Karte>
          <p className="text-[15px] text-gray-700">An diesem Tag ist online leider nichts mehr frei.</p>
          <Knopf className="mt-4 w-full sm:w-auto" onClick={onDatumAendern}>Anderen Tag wählen</Knopf>
        </Karte>
      ) : !passendFrei ? (
        <Karte>
          <p className="text-[15px] text-gray-700">
            Für {kinder} Kinder ist an diesem Tag online leider keine Loge mehr frei. Wählt einen anderen Tag
            oder ruft uns an, dann finden wir gemeinsam eine Lösung: <a href={TELEFON_LINK} className="font-bold text-ups-blau underline underline-offset-2">{TELEFON_ANZEIGE}</a>
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Knopf onClick={onDatumAendern}>Anderen Tag wählen</Knopf>
            <Knopf art="zweit" onClick={onKinderAendern}>Kinderzahl ändern</Knopf>
          </div>
        </Karte>
      ) : (
        <>
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ups-blau">Uhrzeit</h3>
          <div className={`grid gap-3 ${slots.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {slots.map(s => {
              const anzahl = s.logen.length
              const aktiv = s.zeitslot === zeitslot
              return (
                <button
                  key={s.zeitslot}
                  type="button"
                  disabled={anzahl === 0}
                  onClick={() => onSlot(s.zeitslot)}
                  aria-pressed={aktiv}
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left ring-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    aktiv ? 'bg-ups-blau text-white ring-ups-blau' : 'bg-white text-ups-navy ring-ups-hell hover:ring-ups-himmel'
                  }`}
                >
                  <span>
                    <span className={`block text-sm font-bold ${aktiv ? 'text-white/80' : 'text-gray-500'}`}>{slotBezeichnung(s)}</span>
                    <span className="block text-xl font-extrabold">{s.start}–{s.ende} Uhr</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${aktiv ? 'bg-white/20' : anzahl === 0 ? 'bg-gray-100 text-gray-500' : 'bg-ups-eis text-ups-blau'}`}>
                    {anzahl === 0 ? 'ausgebucht' : anzahl === 1 ? '1 Loge frei' : `${anzahl} Logen frei`}
                  </span>
                </button>
              )
            })}
          </div>

          {slot && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-extrabold uppercase tracking-wide text-ups-blau">Eure Loge</h3>
              <Regel kinder={kinder} />
              <div className="grid gap-3 sm:grid-cols-2">
                {slot.logen.map(l => {
                  const aktiv = l.loge_id === logeId
                  const angeboten = aktiv && ganzeLogeAngeboten(l, kinder)
                  return (
                    <div key={l.loge_id} className={`rounded-2xl ring-2 transition-colors ${aktiv ? 'bg-ups-eis ring-ups-blau' : 'bg-white ring-ups-hell hover:ring-ups-himmel'}`}>
                      <button
                        type="button"
                        onClick={() => onLoge(l.loge_id)}
                        aria-pressed={aktiv}
                        className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                      >
                        <LogenBild name={l.name} bildUrl={l.bild_url} className="h-14 w-14" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[17px] font-extrabold leading-tight text-ups-navy">{l.name}</span>
                          {l.ist_babywelt && (
                            <span className="mt-1 inline-flex rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700">Babywelt</span>
                          )}
                          {/* Belegungs-Etikett immer in eigener Zeile → alle Karten gleich aufgebaut */}
                          <span className="mt-1.5 block">
                            <Etikett art={logenEtikett(l, kinder, aktiv && ganzeLoge && angeboten)} />
                          </span>
                        </span>
                        <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${aktiv ? 'bg-ups-blau text-white' : 'ring-2 ring-ups-hell'}`}>
                          {aktiv && <Haekchen className="h-4 w-4" />}
                        </span>
                      </button>
                      {angeboten && (
                        <label className="mx-3 mb-3 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-ups-hell">
                          <input
                            type="checkbox"
                            checked={ganzeLoge}
                            onChange={e => onGanzeLoge(e.target.checked)}
                            className="mt-0.5 h-6 w-6 shrink-0 accent-ups-blau"
                          />
                          <span className="text-[15px] leading-snug">
                            <span className="block font-bold text-ups-navy">{textGanzeLogeOption(aufpreis)}</span>
                            <span className="block text-[13px] text-gray-600">
                              Am zweiten Tisch feiert dann niemand sonst. Berechnet werden {GANZE_LOGE_MIN_KINDER} Kinder.
                            </span>
                          </span>
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {tag.preis_pro_kind !== undefined && (
            <p className="mt-5 text-center text-sm text-gray-500">
              {euro(tag.preis_pro_kind)} pro Kind{tag.wochenendpreis ? ' (Wochenend-/Feiertagspreis)' : ''}
            </p>
          )}
        </>
      )}
    </>
  )
}
