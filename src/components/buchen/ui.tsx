// Kleine UI-Bausteine der öffentlichen Online-Buchung (Upsalla-Farben, Touch ≥ 48px).
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { StatusSymbol, type StatusArt } from './StatusSymbol'

export const TITEL_SCHRIFT = '[font-family:var(--font-fredoka),var(--font-nunito),sans-serif]'

type KnopfArt = 'haupt' | 'zweit' | 'text'

const KNOPF_KLASSEN: Record<KnopfArt, string> = {
  haupt: 'bg-ups-blau text-white shadow-md shadow-ups-blau/25 hover:bg-ups-blau-dunkel active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none',
  zweit: 'bg-white text-ups-navy ring-2 ring-ups-hell hover:ring-ups-himmel active:scale-[0.98] disabled:opacity-50',
  text: 'bg-transparent text-ups-blau underline-offset-4 hover:underline disabled:opacity-50',
}

export function Knopf({ art = 'haupt', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { art?: KnopfArt }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-extrabold disabled:cursor-not-allowed ${KNOPF_KLASSEN[art]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Karte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ups-hell sm:p-6 ${className}`}>{children}</section>
}

export function SchrittTitel({ titel, untertitel }: { titel: string; untertitel?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className={`${TITEL_SCHRIFT} text-2xl font-semibold text-ups-navy sm:text-3xl`}>{titel}</h2>
      {untertitel && <p className="mt-1 text-[15px] text-gray-600">{untertitel}</p>}
    </div>
  )
}

type HinweisTon = 'info' | 'warnung' | 'fehler'
const HINWEIS_KLASSEN: Record<HinweisTon, string> = {
  info: 'bg-ups-eis text-ups-navy ring-ups-hell',
  warnung: 'bg-ups-creme text-[#6b4a00] ring-ups-gelb',
  fehler: 'bg-red-50 text-red-800 ring-red-200',
}
const HINWEIS_SYMBOL: Record<HinweisTon, StatusArt> = { info: 'info', warnung: 'warten', fehler: 'warnung' }

export function Hinweis({ ton = 'info', children }: { ton?: HinweisTon; children: ReactNode }) {
  return (
    <div role={ton === 'info' ? 'status' : 'alert'} className={`mb-4 flex gap-3 rounded-2xl p-4 text-[15px] leading-snug ring-1 ${HINWEIS_KLASSEN[ton]}`}>
      <StatusSymbol art={HINWEIS_SYMBOL[ton]} className="h-6 w-6 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

// Plus/Minus-Zähler mit großen Tasten
export function Stepper({ label, beschreibung, wert, min, max, onChange }: {
  label: string
  beschreibung?: ReactNode
  wert: number
  min: number
  max: number
  onChange: (wert: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="text-lg font-extrabold text-ups-navy">{label}</div>
        {beschreibung && <div className="text-sm text-gray-500">{beschreibung}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={`${label}: weniger`}
          disabled={wert <= min}
          onClick={() => onChange(wert - 1)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-ups-eis text-2xl font-extrabold text-ups-blau ring-1 ring-ups-hell hover:bg-ups-hell active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
        >
          −
        </button>
        <output aria-live="polite" aria-label={label} className={`${TITEL_SCHRIFT} w-10 text-center text-3xl font-semibold text-ups-navy`}>{wert}</output>
        <button
          type="button"
          aria-label={`${label}: mehr`}
          disabled={wert >= max}
          onClick={() => onChange(wert + 1)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-ups-blau text-2xl font-extrabold text-white hover:bg-ups-blau-dunkel active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          +
        </button>
      </div>
    </div>
  )
}

// Untere Aktionsleiste: auf dem Handy am Bildschirmrand klebend, damit „Weiter“ immer erreichbar ist
export function Aktionsleiste({ children }: { children: ReactNode }) {
  return (
    <div data-aktionsleiste className="sticky bottom-0 z-10 -mx-3 mt-6 border-t border-ups-hell bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="flex items-center justify-between gap-3">{children}</div>
    </div>
  )
}

export function Lader({ text = 'Wird geladen…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-gray-500" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-ups-hell border-t-ups-blau" aria-hidden />
      {text}
    </div>
  )
}
