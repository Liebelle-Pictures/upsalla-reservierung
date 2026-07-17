'use client'

import { useRouter } from 'next/navigation'

interface Props {
  datum: string
  logeId: string
  zeitslot: number
  farbe?: string
}

export function FreierSlot({ datum, logeId, zeitslot, farbe = '#6366F1' }: Props) {
  const router = useRouter()

  return (
    <button
      onClick={() => {
        const params = new URLSearchParams({ datum, loge_id: logeId, zeitslot: String(zeitslot) })
        router.push(`/reservierungen/neu?${params}`)
      }}
      className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl group"
      aria-label="Neue Reservierung"
    >
      <span
        className="flex items-center justify-center rounded-full font-bold text-xl"
        style={{
          width: '44px',
          height: '44px',
          background: `${farbe}18`,
          color: farbe,
          opacity: 0.5,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
      >
        +
      </span>
    </button>
  )
}
