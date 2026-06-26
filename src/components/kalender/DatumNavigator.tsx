'use client'

import { useRouter } from 'next/navigation'

interface Props {
  datum: string  // YYYY-MM-DD
}

function formatAnzeige(datum: string): string {
  const d = new Date(datum + 'T00:00:00')
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function verschiebeTag(datum: string, tage: number): string {
  const d = new Date(datum + 'T00:00:00')
  d.setDate(d.getDate() + tage)
  return d.toISOString().slice(0, 10)
}

export function DatumNavigator({ datum }: Props) {
  const router = useRouter()

  const navigiere = (zielDatum: string) => {
    router.push(`/?datum=${zielDatum}`)
  }

  const heute = new Date().toISOString().slice(0, 10)
  const istHeute = datum === heute

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => navigiere(verschiebeTag(datum, -1))}
        className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-lg font-medium"
        aria-label="Vorheriger Tag"
      >
        ‹
      </button>

      <div className="flex-1 text-center">
        <p className="font-semibold text-gray-900">{formatAnzeige(datum)}</p>
        {!istHeute && (
          <button
            onClick={() => navigiere(heute)}
            className="text-xs text-blue-600 hover:underline mt-0.5"
          >
            Zurück zu heute
          </button>
        )}
      </div>

      <button
        onClick={() => navigiere(verschiebeTag(datum, 1))}
        className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-lg font-medium"
        aria-label="Nächster Tag"
      >
        ›
      </button>
    </div>
  )
}
