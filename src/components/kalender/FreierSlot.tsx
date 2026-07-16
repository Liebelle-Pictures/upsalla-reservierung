'use client'

import { useRouter } from 'next/navigation'

interface Props {
  datum: string
  logeId: string
  zeitslot: number
  farbe?: string
}

export function FreierSlot({ datum, logeId, zeitslot, farbe = '#C7C7CC' }: Props) {
  const router = useRouter()

  return (
    <button
      onClick={() => {
        const params = new URLSearchParams({ datum, loge_id: logeId, zeitslot: String(zeitslot) })
        router.push(`/reservierungen/neu?${params}`)
      }}
      className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-2xl group transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{ border: `2px dashed ${farbe}50` }}
    >
      <span
        className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-light transition-all group-hover:scale-110"
        style={{ background: `${farbe}15`, color: farbe }}
      >
        +
      </span>
      <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: farbe }}>
        Neu
      </span>
    </button>
  )
}
