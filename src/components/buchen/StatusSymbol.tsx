// Eigene SVG-Symbole für Statusseiten und Hinweise der Online-Buchung —
// gleicher Stil wie LogenSymbol (48er-Raster, dunkelblaue Kontur, Upsalla-Farben).
import type { ReactNode } from 'react'

const F = {
  navy: '#014d78',
  blau: '#0372b1',
  himmel: '#74c0e3',
  gelb: '#ffda00',
  orange: '#ef6d00',
  koralle: '#f26b6b',
  gruen: '#418857',
  creme: '#fff1b6',
  weiss: '#ffffff',
}

const KONTUR = { stroke: F.navy, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export type StatusArt = 'erfolg' | 'warten' | 'zurueck' | 'warnung' | 'info'

const MOTIVE: Record<StatusArt, ReactNode> = {
  // Häkchen im Kreis mit Konfetti
  erfolg: (
    <g {...KONTUR}>
      <circle cx={24} cy={26} r={14} fill={F.gruen} />
      <path d="M17.5 26.5l4.5 4.5l9-9.5" fill="none" stroke={F.weiss} strokeWidth={3.5} />
      <path d="M8 9l3 3M40 8l-2.5 3.5M24 3v4" fill="none" stroke={F.orange} strokeWidth={2.5} />
      <circle cx={6} cy={22} r={2} fill={F.gelb} strokeWidth={1.3} />
      <circle cx={42} cy={20} r={2} fill={F.koralle} strokeWidth={1.3} />
      <rect x={38.5} y={38} width={4} height={4} rx={1} transform="rotate(20 40.5 40)" fill={F.himmel} strokeWidth={1.3} />
      <rect x={5} y={37} width={4} height={4} rx={1} transform="rotate(-15 7 39)" fill={F.gelb} strokeWidth={1.3} />
    </g>
  ),
  // Sanduhr
  warten: (
    <g {...KONTUR}>
      <path d="M14 6h20M14 42h20" strokeWidth={3} />
      <path d="M16 6c0 9 8 12 8 18s-8 9-8 18h16c0-9-8-12-8-18s8-9 8-18z" fill={F.weiss} />
      <path d="M19.5 12h9c-1 3-4.5 5.5-4.5 8c0-2.5-3.5-5-4.5-8z" fill={F.gelb} strokeWidth={1.4} />
      <path d="M18.5 40c.5-4 5.5-7 5.5-9c0 2 5 5 5.5 9z" fill={F.gelb} strokeWidth={1.4} />
    </g>
  ),
  // Pfeil zurück
  zurueck: (
    <g {...KONTUR}>
      <circle cx={24} cy={24} r={18} fill={F.blau} />
      <path d="M31.5 31v-4a6 6 0 0 0-6-6h-11" fill="none" stroke={F.weiss} strokeWidth={3.5} />
      <path d="M19.5 15l-6 6l6 6" fill="none" stroke={F.weiss} strokeWidth={3.5} />
    </g>
  ),
  // Warndreieck
  warnung: (
    <g {...KONTUR}>
      <path d="M24 6L43 39H5z" fill={F.gelb} strokeWidth={2.5} />
      <path d="M24 18v10" stroke={F.navy} strokeWidth={3.5} />
      <circle cx={24} cy={33.5} r={1.8} fill={F.navy} strokeWidth={1} />
    </g>
  ),
  // Info-Kreis
  info: (
    <g {...KONTUR}>
      <circle cx={24} cy={24} r={18} fill={F.himmel} />
      <path d="M24 22v11" stroke={F.navy} strokeWidth={3.5} />
      <circle cx={24} cy={15.5} r={2} fill={F.navy} strokeWidth={1} />
    </g>
  ),
}

export function StatusSymbol({ art, className = 'h-6 w-6' }: { art: StatusArt; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      {MOTIVE[art]}
    </svg>
  )
}

// Kleines Häkchen (Fortschritt, gewählte Loge) — erbt die Textfarbe
export function Haekchen({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
