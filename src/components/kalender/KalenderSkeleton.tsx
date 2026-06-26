export function KalenderSkeleton() {
  return (
    <div className="overflow-x-auto -mx-4 px-4 animate-pulse">
      <div className="min-w-[640px]">
        {/* Kopfzeile */}
        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '80px repeat(9, minmax(110px, 1fr))' }}>
          <div />
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-lg" />
          ))}
        </div>

        {/* 1-2 Zeitslot Zeilen */}
        {Array.from({ length: 2 }).map((_, row) => (
          <div key={row} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '80px repeat(9, minmax(110px, 1fr))' }}>
            <div className="h-20 bg-gray-100 rounded-lg" />
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
