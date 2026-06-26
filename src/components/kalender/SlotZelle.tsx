'use client'

import type { SlotVerfuegbarkeit } from '@/types/loge'

interface Props {
  slot: SlotVerfuegbarkeit
  onClick: (slot: SlotVerfuegbarkeit) => void
}

// Tap auf freien Slot → Reservierung erstellen
export function SlotZelle({ slot, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(slot)}
      className="w-full min-h-[48px] p-2 border border-gray-200 rounded text-left text-sm hover:bg-blue-50 transition-colors"
    >
      {slot.verfuegbar ? 'Frei' : 'Belegt'}
    </button>
  )
}
