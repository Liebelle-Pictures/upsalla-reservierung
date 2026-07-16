'use client'

import { useRouter } from 'next/navigation'

interface Props {
  datum: string
  logeId: string
  zeitslot: number
}

export function FreierSlot({ datum, logeId, zeitslot }: Props) {
  const router = useRouter()

  const handleClick = () => {
    const params = new URLSearchParams({ datum, loge_id: logeId, zeitslot: String(zeitslot) })
    router.push(`/reservierungen/neu?${params}`)
  }

  return (
    <button
      onClick={handleClick}
      className="w-full h-full min-h-[88px] rounded-2xl flex items-center justify-center group transition-all hover:scale-[1.02]"
      style={{ border: '1.5px dashed var(--border)', color: 'var(--text-tertiary)' }}
    >
      <span
        className="text-2xl font-light transition-colors group-hover:text-violet-400"
        style={{ color: 'var(--border-strong)' }}
      >
        +
      </span>
    </button>
  )
}
