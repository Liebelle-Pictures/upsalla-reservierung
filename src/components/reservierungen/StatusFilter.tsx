'use client'

import { useRouter } from 'next/navigation'

const FILTER = [
  { wert: 'ALLE',                  label: 'Alle' },
  { wert: 'BESTAETIGT_AUSSTEHEND', label: 'Ausstehend' },
  { wert: 'BESTAETIGT_BEZAHLT',    label: 'Bezahlt' },
  { wert: 'GRUPPENANGEBOT',        label: 'Gruppen' },
  { wert: 'STORNIERT',             label: 'Storniert' },
]

interface Props {
  aktiv: string
}

export function StatusFilter({ aktiv }: Props) {
  const router = useRouter()

  return (
    <div
      className="flex gap-1.5 p-1.5 rounded-2xl flex-wrap"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'inline-flex' }}
    >
      {FILTER.map((f) => {
        const isAktiv = aktiv === f.wert
        return (
          <button
            key={f.wert}
            onClick={() => router.push(`/reservierungen?status=${f.wert}`)}
            className="h-9 px-4 rounded-xl text-sm font-medium transition-all"
            style={{
              background: isAktiv ? 'var(--accent)' : 'transparent',
              color: isAktiv ? 'white' : 'var(--text-secondary)',
            }}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
