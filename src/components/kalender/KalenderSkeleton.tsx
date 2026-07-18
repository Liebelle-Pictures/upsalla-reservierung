import React from 'react'

export function KalenderSkeleton() {
  return (
    <div
      className="rounded-2xl animate-pulse overflow-hidden"
      style={{
        height: 'calc(100vh - 145px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '72px repeat(7, minmax(140px, 1fr))',
          gridTemplateRows: 'auto 1fr 1fr',
          gap: '8px',
          padding: '16px',
          height: '100%',
        }}
      >
        <div />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-2xl" style={{ background: '#E5E5EA' }} />
        ))}
        {Array.from({ length: 2 }).map((_, row) => (
          <React.Fragment key={row}>
            <div className="rounded-2xl" style={{ background: '#F2F2F7' }} />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-2xl" style={{ background: '#F2F2F7' }} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
