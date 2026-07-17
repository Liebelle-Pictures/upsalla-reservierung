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
    <div className="flex gap-2 flex-wrap">
      {FILTER.map(f => {
        const isAktiv = aktiv === f.wert
        return (
          <button
            key={f.wert}
            onClick={() => router.push(`/reservierungen?status=${f.wert}`)}
            className="h-9 px-4 rounded-full text-sm font-semibold"
            style={{
              background: isAktiv ? 'var(--color-primary)' : 'var(--color-surface)',
              color: isAktiv ? '#fff' : 'var(--color-text-muted)',
              border: isAktiv ? 'none' : `1.5px solid var(--color-border)`,
            }}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
