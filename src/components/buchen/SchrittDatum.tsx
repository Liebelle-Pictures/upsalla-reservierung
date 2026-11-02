// Schritt 1: Monatskalender. Grau = nicht buchbar, oranger Punkt = nur noch wenige Plätze.
import { kalenderWochen, istWaehlbar, monatName, monatPlus, type MonatAntwort, type MonatsTag } from './wizardLogik'
import { Hinweis, Karte, Lader, SchrittTitel, TITEL_SCHRIFT } from './ui'

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const STATUS_TEXT: Record<MonatsTag['status'], string> = {
  frei: 'frei',
  wenige: 'nur noch wenige Plätze',
  ausgebucht: 'ausgebucht',
  geschlossen: 'geschlossen',
  nicht_buchbar: 'nicht online buchbar',
}

export function SchrittDatum({ monat, ersterMonat, letzterMonat, daten, laedt, fehler, gewaehlt, onMonat, onWaehle, onNeuLaden }: {
  monat: string
  ersterMonat: string
  letzterMonat: string
  daten: MonatAntwort | null
  laedt: boolean
  fehler: string | null
  gewaehlt: string | null
  onMonat: (monat: string) => void
  onWaehle: (datum: string) => void
  onNeuLaden: () => void
}) {
  const tagMap = new Map((daten?.tage ?? []).map(t => [t.datum, t]))
  const hatFreieTage = (daten?.tage ?? []).some(t => istWaehlbar(t.status))

  return (
    <>
      <SchrittTitel titel="Wann wollt ihr feiern?" untertitel="Wählt einen Tag für den Kindergeburtstag." />
      <Karte className="px-1.5 sm:px-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => onMonat(monatPlus(monat, -1))}
            disabled={monat <= ersterMonat}
            aria-label="Vorheriger Monat"
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-extrabold text-ups-blau hover:bg-ups-eis disabled:text-gray-300"
          >
            ‹
          </button>
          <h3 className={`${TITEL_SCHRIFT} text-xl font-semibold capitalize text-ups-navy`} aria-live="polite">{monatName(monat)}</h3>
          <button
            type="button"
            onClick={() => onMonat(monatPlus(monat, 1))}
            disabled={monat >= letzterMonat}
            aria-label="Nächster Monat"
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-extrabold text-ups-blau hover:bg-ups-eis disabled:text-gray-300"
          >
            ›
          </button>
        </div>

        {fehler ? (
          <div className="p-3">
            <Hinweis ton="fehler">{fehler}</Hinweis>
            <button type="button" onClick={onNeuLaden} className="min-h-12 font-bold text-ups-blau underline">Erneut versuchen</button>
          </div>
        ) : laedt || !daten ? (
          <Lader text="Freie Termine werden geladen…" />
        ) : (
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                {WOCHENTAGE.map(w => (
                  <th key={w} scope="col" className={`pb-1 text-xs font-bold ${w === 'Sa' || w === 'So' ? 'text-ups-blau' : 'text-gray-500'}`}>{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kalenderWochen(monat).map((woche, wi) => (
                <tr key={wi}>
                  {woche.map((datum, ti) => {
                    if (!datum) return <td key={ti} />
                    const tag = tagMap.get(datum)
                    const status = tag?.status ?? 'nicht_buchbar'
                    const waehlbar = istWaehlbar(status)
                    const aktiv = datum === gewaehlt
                    const nr = Number(datum.slice(8))
                    return (
                      <td key={ti} className="p-0 text-center">
                        <button
                          type="button"
                          disabled={!waehlbar}
                          onClick={() => onWaehle(datum)}
                          aria-pressed={aktiv}
                          aria-label={`${nr}. ${monatName(monat)}: ${STATUS_TEXT[status]}`}
                          className="group relative mx-auto flex h-12 w-full max-w-14 flex-col items-center justify-center disabled:cursor-default"
                        >
                          <span className={`flex h-10 w-10 items-center justify-center rounded-full text-[17px] transition-colors ${
                            aktiv ? 'bg-ups-blau font-extrabold text-white shadow-md'
                              : waehlbar ? 'font-extrabold text-ups-navy group-hover:bg-ups-eis'
                              : status === 'ausgebucht' ? 'font-semibold text-gray-300 line-through'
                              : 'font-medium text-gray-300'
                          }`}>
                            {nr}
                          </span>
                          {status === 'wenige' && !aktiv && (
                            <span aria-hidden className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-ups-orange" />
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-2 pb-1 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ups-orange" aria-hidden />nur noch wenige Plätze</span>
          <span className="flex items-center gap-1.5"><span className="font-bold text-gray-300 line-through" aria-hidden>12</span>ausgebucht / nicht buchbar</span>
        </div>
      </Karte>

      {daten && !laedt && !fehler && !hatFreieTage && (
        <p className="mt-4 text-center text-[15px] text-gray-600">In diesem Monat ist online leider nichts mehr frei. Schaut gerne in den nächsten Monat.</p>
      )}
    </>
  )
}
