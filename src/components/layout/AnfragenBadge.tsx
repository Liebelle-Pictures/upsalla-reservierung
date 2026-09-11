'use client'

import { useEffect, useState } from 'react'
import { getOffeneAnfragenAnzahl } from '@/app/actions/anfragen'

const POLL_MS = 15000

export function AnfragenBadge({ initial = 0 }: { initial?: number }) {
  const [anzahl, setAnzahl] = useState(initial)

  useEffect(() => {
    let aktiv = true
    const laden = () => {
      getOffeneAnfragenAnzahl().then(n => { if (aktiv) setAnzahl(n) }).catch(() => {})
    }
    // Sofort beim Mounten pruefen statt auf den ersten Intervall-Tick zu warten — der vom
    // Server mitgegebene "initial"-Wert kann durch die Zeit zwischen Server-Rendering und
    // Anzeige im Browser bereits veraltet sein (z.B. wenn zwischendurch etwas erledigt wurde).
    laden()
    const id = setInterval(laden, POLL_MS)
    // Sofort neu laden, wenn irgendwo im UI (z.B. "Erledigt"-Button) eine Änderung passiert —
    // ohne auf den nächsten Intervall-Tick warten zu müssen.
    window.addEventListener('anfragen-aktualisiert', laden)
    return () => {
      aktiv = false
      clearInterval(id)
      window.removeEventListener('anfragen-aktualisiert', laden)
    }
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
