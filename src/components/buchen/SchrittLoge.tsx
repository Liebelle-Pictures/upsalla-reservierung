// Schritt 2: Uhrzeit wählen, dann eine freie Loge. Teilweise belegte Logen erscheinen ganz
// normal, nur mit der passenden Höchstzahl an Kindern (kommt vom Server).
import { datumLang, euro, slotBezeichnung, TEXT_GANZ, TEXT_GETEILT_ERKLAERUNG, TEXT_GETEILT_KARTE, type TagAntwort } from './wizardLogik'
import { Haekchen } from './StatusSymbol'
import { GeteiltSymbol, LogenBild } from './LogenSymbol'
import { Hinweis, Karte, Knopf, Lader, SchrittTitel } from './ui'

export function SchrittLoge({ datum, tag, laedt, fehler, hinweis, zeitslot, logeId, onSlot, onLoge, onDatumAendern, onNeuLaden }: {
  datum: string
  tag: TagAntwort | null
  laedt: boolean
  fehler: string | null
  hinweis: string | null
  zeitslot: number | null
  logeId: string | null
  onSlot: (zeitslot: number) => void
  onLoge: (logeId: string) => void
  onDatumAendern: () => void
  onNeuLaden: () => void
}) {
  const slot = tag?.slots.find(s => s.zeitslot === zeitslot) ?? null

  return (
    <>
      <SchrittTitel
        titel="Uhrzeit & Loge"
        untertitel={<>
          <span className="font-bold text-ups-navy">{datumLang(datum)}</span>{' · '}
          <button type="button" onClick={onDatumAendern} className="font-bold text-ups-blau underline underline-offset-4">ändern</button>
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
      ) : (
        <>
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ups-blau">Uhrzeit</h3>
          <div className={`grid gap-3 ${tag.slots.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {tag.slots.map(s => {
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
              {slot.logen.some(l => l.geteilt) && (
                <p className="mb-3 flex gap-2 rounded-2xl bg-ups-creme/70 px-3.5 py-2.5 text-[14px] font-semibold leading-snug text-[#6b4a00] ring-1 ring-ups-gelb/50">
                  <GeteiltSymbol className="mt-0.5 h-4 w-4 shrink-0" />{TEXT_GETEILT_ERKLAERUNG}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {slot.logen.map(l => {
                  const aktiv = l.loge_id === logeId
                  return (
                    <button
                      key={l.loge_id}
                      type="button"
                      onClick={() => onLoge(l.loge_id)}
                      aria-pressed={aktiv}
                      className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left ring-2 transition-colors ${
                        aktiv ? 'bg-ups-eis ring-ups-blau' : 'bg-white ring-ups-hell hover:ring-ups-himmel'
                      }`}
                    >
                      <LogenBild name={l.name} bildUrl={l.bild_url} className="h-14 w-14" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-extrabold leading-tight text-ups-navy">{l.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                          bis {l.max_kinder} Kinder
                          {l.ist_babywelt && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700">Babywelt</span>}
                        </span>
                        {/* Belegungs-Etikett immer in eigener Zeile → alle Karten gleich aufgebaut */}
                        <span className="mt-1.5 block">
                          {l.geteilt
                            ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ups-creme px-2 py-0.5 text-xs font-bold text-[#6b4a00] ring-1 ring-ups-gelb/60"><GeteiltSymbol className="h-3.5 w-3.5" />{TEXT_GETEILT_KARTE}</span>
                            : <span className="inline-flex whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-ups-gruen ring-1 ring-green-200">{TEXT_GANZ}</span>}
                        </span>
                      </span>
                      <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${aktiv ? 'bg-ups-blau text-white' : 'ring-2 ring-ups-hell'}`}>
                        {aktiv && <Haekchen className="h-4 w-4" />}
                      </span>
                    </button>
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
