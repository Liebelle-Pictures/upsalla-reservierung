// Eigene, generische Themen-Symbole für die Logen (keine Figuren, Logos oder Film-Schriften).
// Einheitlicher Stil: 48er-Raster, dunkelblaue Kontur, flächige Upsalla-Farben.
// Zuordnung über den Logen-Namen; unbekannte Logen bekommen einen Luftballon.
import type { ReactNode } from 'react'

const F = {
  navy: '#014d78',
  blau: '#0372b1',
  himmel: '#74c0e3',
  hell: '#c8e7f5',
  gelb: '#ffda00',
  orange: '#ef6d00',
  koralle: '#f26b6b',
  rosa: '#f7a8c4',
  gruen: '#418857',
  creme: '#fff1b6',
  weiss: '#ffffff',
}

const KONTUR = { stroke: F.navy, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

export type SymbolArt =
  | 'schneeflocke' | 'pfote_blau' | 'pfote_rosa' | 'netz' | 'loewe' | 'schloss'
  | 'regenbogen' | 'rassel' | 'mond' | 'zelt' | 'tisch' | 'ballon'

// Name → Symbol. Reihenfolge wichtig (z. B. „Babywelt Märchen“ vor „Babywelt“).
export function symbolFuerLoge(name: string): SymbolArt {
  const n = name.toLowerCase()
  if (n.includes('anna') || n.includes('elsa')) return 'schneeflocke'
  if (n.includes('paw')) return n.includes('mädchen') || n.includes('maedchen') ? 'pfote_rosa' : 'pfote_blau'
  if (n.includes('spider')) return 'netz'
  if (n.includes('safari')) return 'loewe'
  if (n.includes('schloss')) return 'schloss'
  if (n.includes('regenbogen')) return 'regenbogen'
  if (n.includes('babywelt')) return n.includes('märchen') || n.includes('maerchen') ? 'mond' : 'rassel'
  if (n.includes('bbq') || n.includes('zelt')) return 'zelt'
  if (n.includes('rund') || n.includes('tisch')) return 'tisch'
  return 'ballon'
}

// Hintergrundfarbe der Symbol-Kachel
export const SYMBOL_HINTERGRUND: Record<SymbolArt, string> = {
  schneeflocke: '#e3f3fb',
  pfote_blau: '#e3f3fb',
  pfote_rosa: '#fde8ef',
  netz: '#fde8e8',
  loewe: '#fff5d1',
  schloss: '#fde8ef',
  regenbogen: '#e8f5ec',
  rassel: '#e3f3fb',
  mond: '#e6eef6',
  zelt: '#fff1e3',
  tisch: '#fff5d1',
  ballon: '#fff5d1',
}

function stern(cx: number, cy: number, r: number): string {
  // Fünfzackiger Stern
  const punkte: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const winkel = (Math.PI / 5) * i - Math.PI / 2
    punkte.push(`${(cx + radius * Math.cos(winkel)).toFixed(2)},${(cy + radius * Math.sin(winkel)).toFixed(2)}`)
  }
  return `M${punkte.join('L')}Z`
}

function netzPfad(): string {
  // Speichen + leicht durchhängende Ringe
  const cx = 24, cy = 24, speichen = 8
  const punkt = (r: number, i: number) => {
    const w = (Math.PI * 2 * i) / speichen - Math.PI / 2
    return [cx + r * Math.cos(w), cy + r * Math.sin(w)]
  }
  let d = ''
  for (let i = 0; i < speichen; i++) {
    const [x, y] = punkt(19, i)
    d += `M${cx},${cy}L${x.toFixed(2)},${y.toFixed(2)}`
  }
  for (const r of [6, 11.5, 17]) {
    const [x0, y0] = punkt(r, 0)
    d += `M${x0.toFixed(2)},${y0.toFixed(2)}`
    for (let i = 1; i <= speichen; i++) {
      const [x, y] = punkt(r, i)
      const [kx, ky] = punkt(r * 0.78, i - 0.5)
      d += `Q${kx.toFixed(2)},${ky.toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`
    }
  }
  return d
}
const NETZ = netzPfad()

const WOLKE = 'M2 40h12.5a3.4 3.4 0 0 0 0-6.8a4.8 4.8 0 0 0-9.2-0.8a3.8 3.8 0 0 0-3.3 7.6z'

const MOTIVE: Record<SymbolArt, ReactNode> = {
  schneeflocke: (
    <g stroke={F.blau} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {[0, 60, 120, 180, 240, 300].map(w => (
        <g key={w} transform={`rotate(${w} 24 24)`}>
          <path d="M24 24V6" />
          <path d="M19 10.5l5 4.5l5-4.5" stroke={F.himmel} />
        </g>
      ))}
      <circle cx={24} cy={24} r={3.5} fill={F.weiss} stroke={F.navy} strokeWidth={2} />
    </g>
  ),
  pfote_blau: <Pfote farbe={F.blau} />,
  pfote_rosa: <Pfote farbe={F.koralle} />,
  netz: (
    <g>
      <path d={NETZ} fill="none" stroke={F.navy} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={24} cy={24} r={2.5} fill={F.koralle} {...KONTUR} strokeWidth={1.5} />
    </g>
  ),
  loewe: (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const w = (Math.PI * 2 * i) / 12
        return <circle key={i} cx={24 + 14 * Math.cos(w)} cy={24 + 14 * Math.sin(w)} r={5} fill={F.orange} {...KONTUR} />
      })}
      <circle cx={24} cy={24} r={14} fill={F.orange} />
      <circle cx={24} cy={25} r={10.5} fill={F.gelb} {...KONTUR} />
      <circle cx={20} cy={23} r={1.6} fill={F.navy} />
      <circle cx={28} cy={23} r={1.6} fill={F.navy} />
      <path d="M22 27h4l-2 2.2z" fill={F.navy} {...KONTUR} strokeWidth={1.2} />
      <path d="M20.5 30.5q3.5 2.5 7 0" fill="none" {...KONTUR} strokeWidth={1.6} />
    </g>
  ),
  schloss: (
    <g {...KONTUR}>
      <rect x={9} y={20} width={8} height={21} fill={F.rosa} />
      <rect x={31} y={20} width={8} height={21} fill={F.rosa} />
      <rect x={17} y={26} width={14} height={15} fill={F.weiss} />
      <path d="M8 20l5-9l5 9z" fill={F.blau} />
      <path d="M30 20l5-9l5 9z" fill={F.blau} />
      <path d="M16 26l8-11l8 11z" fill={F.koralle} />
      <path d="M21 41v-5a3 3 0 0 1 6 0v5z" fill={F.navy} />
      <path d={stern(24, 7, 3.6)} fill={F.gelb} strokeWidth={1.3} />
      <path d={stern(6, 9, 2.6)} fill={F.gelb} strokeWidth={1.2} />
      <path d={stern(42, 8, 2.6)} fill={F.gelb} strokeWidth={1.2} />
    </g>
  ),
  regenbogen: (
    <g fill="none" strokeLinecap="butt">
      {[[20, F.koralle], [15.5, F.gelb], [11, F.gruen], [6.5, F.blau]].map(([r, farbe]) => (
        <path key={r} d={`M${24 - (r as number)} 35A${r} ${r} 0 0 1 ${24 + (r as number)} 35`} stroke={farbe as string} strokeWidth={4.5} />
      ))}
      <path d={WOLKE} fill={F.weiss} {...KONTUR} />
      <path d={WOLKE} transform="translate(48 0) scale(-1 1)" fill={F.weiss} {...KONTUR} />
    </g>
  ),
  rassel: (
    <g {...KONTUR}>
      <path d="M28.5 26.5l9 10" strokeWidth={5.5} stroke={F.navy} />
      <path d="M28.5 26.5l9 10" strokeWidth={2.5} stroke={F.himmel} />
      <circle cx={39.5} cy={39} r={4} fill={F.gelb} />
      <circle cx={21} cy={19} r={12} fill={F.himmel} />
      <path d="M15 11.5a8.5 8.5 0 0 1 6-3" fill="none" stroke={F.weiss} strokeWidth={2.5} />
      <path d={stern(21, 19.5, 5)} fill={F.gelb} strokeWidth={1.4} />
    </g>
  ),
  mond: (
    <g {...KONTUR}>
      <path d="M27 6a17 17 0 1 0 15 26a13.5 13.5 0 1 1-15-26z" fill={F.gelb} />
      <path d={stern(35, 13, 5.5)} fill={F.koralle} strokeWidth={1.5} />
      <path d={stern(41, 24, 2.6)} fill={F.weiss} strokeWidth={1.2} />
    </g>
  ),
  zelt: (
    <g {...KONTUR}>
      <path d="M19 9v-5l6 2.5l-6 2.5" fill={F.koralle} strokeWidth={1.6} />
      <path d="M3 40L19 9l16 31z" fill={F.orange} />
      <path d="M19 40V22l6 18z" fill={F.creme} />
      <path d="M34 31h12a6 6 0 0 1-12 0z" fill={F.navy} />
      <path d="M37 36.5l-2 5M43 36.5l2 5" fill="none" />
      <path d="M38 27q-2-2 0-4.5t0-4.5M43 27q-2-2 0-4.5" fill="none" stroke={F.himmel} strokeWidth={2} />
    </g>
  ),
  tisch: (
    <g {...KONTUR}>
      <path d="M15 19q2.5 6 7 13M32 17q-2 7-6 15" fill="none" strokeWidth={1.4} />
      <ellipse cx={15} cy={12} rx={5.5} ry={6.5} fill={F.koralle} />
      <ellipse cx={32} cy={10} rx={5.5} ry={6.5} fill={F.blau} />
      <path d="M13.5 18.4h3l-1.5 1.6zM30.5 16.4h3l-1.5 1.6z" fill={F.navy} strokeWidth={1} />
      <rect x={22} y={34} width={4} height={8} fill={F.navy} />
      <ellipse cx={24} cy={42.5} rx={7} ry={1.8} fill={F.navy} />
      <ellipse cx={24} cy={33} rx={15} ry={4.5} fill={F.gelb} />
    </g>
  ),
  ballon: (
    <g {...KONTUR}>
      <path d="M24 33q-3 5 1 8t0 6" fill="none" strokeWidth={1.5} />
      <ellipse cx={24} cy={19} rx={11} ry={13} fill={F.koralle} />
      <path d="M22 32h4l-2 2.5z" fill={F.navy} strokeWidth={1} />
      <path d="M18.5 13a7 7 0 0 1 5-4" fill="none" stroke={F.weiss} strokeWidth={2.5} />
    </g>
  ),
}

function Pfote({ farbe }: { farbe: string }) {
  return (
    <g fill={farbe} {...KONTUR}>
      <path d="M24 24c-6 0-12 6.5-12 11.5c0 4 3.5 5.5 6.5 5.5c2.5 0 3.7-1.3 5.5-1.3s3 1.3 5.5 1.3c3 0 6.5-1.5 6.5-5.5c0-5-6-11.5-12-11.5z" />
      <ellipse cx={10.5} cy={21} rx={4} ry={5} transform="rotate(-25 10.5 21)" />
      <ellipse cx={18.5} cy={12.5} rx={4} ry={5.2} transform="rotate(-8 18.5 12.5)" />
      <ellipse cx={29.5} cy={12.5} rx={4} ry={5.2} transform="rotate(8 29.5 12.5)" />
      <ellipse cx={37.5} cy={21} rx={4} ry={5} transform="rotate(25 37.5 21)" />
    </g>
  )
}

export function LogenSymbol({ art, className = '' }: { art: SymbolArt; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      {MOTIVE[art]}
    </svg>
  )
}

// Kachel links auf der Logen-Karte: Foto (falls in logen.bild_url gepflegt), sonst Symbol
export function LogenBild({ name, bildUrl, className = 'h-14 w-14' }: { name: string; bildUrl: string | null; className?: string }) {
  if (bildUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- externe Fotos (Supabase Storage), ohne next/image-Konfiguration
      <img src={bildUrl} alt="" loading="lazy" className={`${className} shrink-0 rounded-2xl object-cover ring-1 ring-ups-hell`} />
    )
  }
  const art = symbolFuerLoge(name)
  return (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-2xl`} style={{ background: SYMBOL_HINTERGRUND[art] }}>
      <LogenSymbol art={art} className="h-[78%] w-[78%]" />
    </span>
  )
}

// Kleines Symbol „zwei Tische / zwei Gruppen“ für geteilte Logen
export function GeteiltSymbol({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={8} cy={8} r={3} />
      <circle cx={17} cy={9} r={2.5} />
      <path d="M2.5 19a5.5 5.5 0 0 1 11 0M13.5 18.5a4 4 0 0 1 8 0" />
    </svg>
  )
}
