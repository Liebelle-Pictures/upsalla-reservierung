// Fortschrittsanzeige der 5 Schritte. Erledigte Schritte sind antippbar (zurückspringen).
import { SCHRITTE, type Schritt } from './wizardLogik'

export function Fortschritt({ schritt, onSpringe }: { schritt: Schritt; onSpringe: (s: Schritt) => void }) {
  return (
    <nav aria-label="Buchungsschritte" className="mb-5">
      <ol className="flex items-start">
        {SCHRITTE.map((name, i) => {
          const nr = (i + 1) as Schritt
          const erledigt = nr < schritt
          const aktiv = nr === schritt
          return (
            <li key={name} className="relative flex flex-1 flex-col items-center">
              {i > 0 && (
                <span aria-hidden className={`absolute right-1/2 top-6 -z-0 h-1 w-full -translate-y-1/2 rounded ${nr <= schritt ? 'bg-ups-blau' : 'bg-ups-hell'}`} />
              )}
              <button
                type="button"
                disabled={!erledigt}
                onClick={() => onSpringe(nr)}
                aria-current={aktiv ? 'step' : undefined}
                aria-label={`Schritt ${nr}: ${name}${erledigt ? ' (erledigt, ändern)' : ''}`}
                className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full disabled:cursor-default"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold transition-colors ${
                  aktiv ? 'bg-ups-blau text-white ring-4 ring-ups-hell'
                    : erledigt ? 'bg-ups-blau text-white'
                    : 'bg-white text-gray-400 ring-2 ring-ups-hell'
                }`}>
                  {erledigt ? '✓' : nr}
                </span>
              </button>
              <span className={`-mt-1 text-center text-[11px] font-bold leading-tight sm:text-xs ${aktiv ? 'text-ups-navy' : 'text-gray-500'}`}>{name}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
