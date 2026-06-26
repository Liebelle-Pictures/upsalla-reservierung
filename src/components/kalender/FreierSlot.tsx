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
      className="w-full h-full min-h-[80px] rounded-lg border-2 border-dashed border-gray-200 text-gray-400 text-xs hover:border-blue-300 hover:text-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center"
    >
      + Neu
    </button>
  )
}
