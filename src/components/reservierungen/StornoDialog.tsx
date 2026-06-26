'use client'

interface Props {
  reservierungId: string
  onBestaetigt: () => void
  onAbgebrochen: () => void
}

export function StornoDialog({ reservierungId, onBestaetigt, onAbgebrochen }: Props) {
  return (
    <div role="dialog" className="p-6">
      <p>Reservierung {reservierungId} wirklich stornieren?</p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onBestaetigt}
          className="min-h-[48px] px-6 bg-red-500 text-white rounded"
        >
          Stornieren
        </button>
        <button
          onClick={onAbgebrochen}
          className="min-h-[48px] px-6 bg-gray-200 rounded"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
