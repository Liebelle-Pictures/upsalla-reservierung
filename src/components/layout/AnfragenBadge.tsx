'use client'

import { useEffect, useState } from 'react'
import { getOffeneAnfragenAnzahl } from '@/app/actions/anfragen'

const POLL_MS = 20000

export function AnfragenBadge({ initial = 0 }: { initial?: number }) {
  const [anzahl, setAnzahl] = useState(initial)

  useEffect(() => {
    let aktiv = true
    const laden = () => {
      getOffeneAnfragenAnzahl().then(n => { if (aktiv) setAnzahl(n) }).catch(() => {})
    }
    const id = setInterval(laden, POLL_MS)
    return () => { aktiv = false; clearInterval(id) }
  }, [])

  if (anzahl === 0) return null

  return (
    <span
      className="flex items-center justify-center rounded-full font-bold shrink-0"
      style={{
        minWidth: '20px',
        height: '20px',
        padding: '0 6px',
        fontSize: '11px',
        background: '#EF4444',
        color: '#fff',
      }}
    >
      {anzahl > 99 ? '99+' : anzahl}
    </span>
  )
}
