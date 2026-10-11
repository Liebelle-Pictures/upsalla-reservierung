'use client'

import { useEffect, useState } from 'react'
import { getOffeneAnfragenAnzahl } from '@/app/actions/anfragen'

// 30s statt vorher 15s — Explizite Aktionen (z.B. "Erledigt"-Button) lösen ohnehin sofort eine
// Aktualisierung aus (siehe Event-Listener unten), das Intervall ist nur ein Fallback, um
// Änderungen aus ANDEREN Tabs/Mitarbeitersitzungen nachzuziehen. Dafür reichen 30s völlig.
const POLL_MS = 30000

// Sidebar (Desktop) und MobileNav rendern BEIDE permanent ein <AnfragenBadge> — nur per CSS
// (hidden/md:flex bzw. md:hidden) wird jeweils eines unsichtbar gemacht, beide bleiben aber im
// DOM gemountet. Ohne dieses Modul-weite Singleton würde das zu ZWEI unabhängigen Intervallen
// führen, die beide alle 15s die gleiche Server-Action (inkl. Middleware-Auth-Check) auslösen —
// doppelte Vercel-Function-Invocations für exakt dieselbe Information. Jetzt: egal wie viele
// <AnfragenBadge>-Instanzen gleichzeitig gemountet sind, es läuft nur EIN Intervall/Request.
type Listener = (anzahl: number) => void
const listeners = new Set<Listener>()
let intervalId: ReturnType<typeof setInterval> | null = null
let letzterWert = 0

function benachrichtigeAlle() {
  getOffeneAnfragenAnzahl()
    .then(n => {
      letzterWert = n
      listeners.forEach(fn => fn(n))
    })
    .catch(() => {})
}

function starteFallsNoetig() {
  if (intervalId !== null) return
  // Nicht pollen, während der Tab im Hintergrund ist — visibilitychange-Listener unten holt
  // beim Zurückkehren sofort den aktuellen Stand nach, kein Datenverlust, nur kein Polling ins Leere.
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  intervalId = setInterval(benachrichtigeAlle, POLL_MS)
}

function stoppeFallsVerwaist() {
  if (listeners.size > 0 || intervalId === null) return
  clearInterval(intervalId)
  intervalId = null
}

function beiSichtbarkeitswechsel() {
  if (document.visibilityState === 'visible') {
    benachrichtigeAlle()
    starteFallsNoetig()
  } else if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', beiSichtbarkeitswechsel)
}

export function AnfragenBadge({ initial = 0 }: { initial?: number }) {
  const [anzahl, setAnzahl] = useState(initial)

  useEffect(() => {
    listeners.add(setAnzahl)
    starteFallsNoetig()
    // Sofort beim Mounten prüfen statt auf den ersten Intervall-Tick zu warten — der vom
    // Server mitgegebene "initial"-Wert kann durch die Zeit zwischen Server-Rendering und
    // Anzeige im Browser bereits veraltet sein. Nur die erste gemountete Instanz löst das
    // aus (letzterWert dient als einfacher "schon initial geladen"-Marker pro Browser-Tab).
    if (letzterWert === 0) benachrichtigeAlle()
    else setAnzahl(letzterWert)

    window.addEventListener('anfragen-aktualisiert', benachrichtigeAlle)
    return () => {
      listeners.delete(setAnzahl)
      stoppeFallsVerwaist()
      window.removeEventListener('anfragen-aktualisiert', benachrichtigeAlle)
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
