// Schritt 2: Anzahl Kinder und Erwachsene mit Live-Preis — VOR der Loge, weil die Kinderzahl
// bestimmt, welche Logen passen und ob ihr die ganze Loge habt. Verbindlich rechnet der Server.
import { FREIE_BEGLEITPERSONEN, MINDEST_KINDER_ABRECHNUNG } from '@/lib/utils/preise'
import { datumLang, euro, preisVorschau, MAX_ERWACHSENE, MAX_KINDER } from './wizardLogik'
import { Karte, SchrittTitel, Stepper, TITEL_SCHRIFT } from './ui'

export function SchrittKinder({ datum, kinder, erwachsene, wochenendpreis, preisProKind, onKinder, onErwachsene, onDatumAendern }: {
  datum: string
  kinder: number
  erwachsene: number
  wochenendpreis: boolean
  preisProKind: number
  onKinder: (n: number) => void
  onErwachsene: (n: number) => void
  onDatumAendern: () => void
}) {
  const p = preisVorschau(kinder, erwachsene, wochenendpreis)

  return (
    <>
      <SchrittTitel
        titel="Wer feiert mit?"
        untertitel={<>
          <span className="font-bold text-ups-navy">{datumLang(datum)}</span>{' · '}
          <button type="button" onClick={onDatumAendern} className="font-bold text-ups-blau underline underline-offset-4">ändern</button>
        </>}
      />
      <Karte>
        <div className="divide-y divide-ups-hell">
          <Stepper
            label="Kinder"
            beschreibung={`${euro(preisProKind)} pro Kind`}
            wert={kinder}
            min={1}
            max={MAX_KINDER}
            onChange={onKinder}
          />
          <Stepper
            label="Erwachsene"
            beschreibung={`${FREIE_BEGLEITPERSONEN} Begleitpersonen frei`}
            wert={erwachsene}
            min={0}
            max={MAX_ERWACHSENE}
            onChange={onErwachsene}
          />
        </div>
      </Karte>

      <div className="mt-4 rounded-3xl bg-ups-navy p-5 text-white shadow-md" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] text-white/80">Gesamt</span>
          <span className={`${TITEL_SCHRIFT} text-2xl font-semibold`}>{euro(p.gesamt)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-bold">Anzahlung heute (20 %)</span>
          <span className={`${TITEL_SCHRIFT} text-3xl font-semibold text-ups-gelb`}>{euro(p.anzahlung)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3 text-sm text-white/70">
          <span>Rest zahlt ihr vor Ort</span>
          <span>{euro(p.rest)}</span>
        </div>
        <p className="mt-3 border-t border-white/15 pt-3 text-[13px] leading-snug text-white/75">
          Mindestens {MINDEST_KINDER_ABRECHNUNG} Kinder werden berechnet · {FREIE_BEGLEITPERSONEN} Begleitpersonen frei
          {kinder < MINDEST_KINDER_ABRECHNUNG && <><br />Ihr seid {kinder} Kinder, berechnet werden {p.abrechenbareKinder}.</>}
        </p>
      </div>
      <p className="mt-3 text-center text-sm text-gray-500">Das Menü wählt ihr ganz entspannt vor Ort im Park aus.</p>
    </>
  )
}
