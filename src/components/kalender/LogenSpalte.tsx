'use client'

import type { Loge } from '@/types'

interface Props {
  loge: Loge
}

export function LogenSpalte({ loge }: Props) {
  return (
    <div className="min-w-[160px]">
      <div className="font-semibold text-sm p-2 bg-gray-100 rounded-t">{loge.name}</div>
      {/* TODO: SlotZellen rendern */}
    </div>
  )
}
