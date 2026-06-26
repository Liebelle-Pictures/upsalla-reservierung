'use client'

import { useRouter } from 'next/navigation'

const FILTER = [
  { wert: 'ALLE',                 label: 'Alle' },
  { wert: 'BESTAETIGT_AUSSTEHEND', label: 'Ausstehend' },
  { wert: 'BESTAETIGT_BEZAHLT',   label: 'Bezahlt' },
  { wert: 'GRUPPENANGEBOT',       label: 'Gruppen' },
  { wert: 'STORNIERT',            label: 'Storniert' },
]

interface Props {
  aktiv: string
}

export function StatusFilter({ aktiv }: Props) {
  const router = useRouter()

  return (
    <div className="flex gap-2 flex-wrap">
      {FILTER.map((f) => (
        <button
          key={f.wert}
          onClick={() => router.push(`/reservierungen?status=${f.wert}`)}
          className={`min-h-[40px] px-4 rounded-full text-sm font-medium transition-colors ${
            aktiv === f.wert
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
