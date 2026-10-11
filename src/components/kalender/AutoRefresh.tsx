'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// router.refresh() ist teuer — es lässt den kompletten Server-Komponenten-Baum der aktuellen
// Route (Layout + Seite) neu rendern, inkl. aller Datenbankabfragen (Logen, Reservierungen,
// Feiertags-/Ferienprüfung, offene Anfragen). Vorher lief das alle 30s UNABHÄNGIG davon, ob der
// Tab überhaupt sichtbar war — bei mehreren durchgehend geöffneten Mitarbeiter-Dashboards über
// den ganzen Tag ein wesentlicher Treiber für Vercel CDN-Requests/Function-Invocations.
export function AutoRefresh({ intervalMs = 60000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null

    const starten = () => {
      if (id !== null) return
      id = setInterval(() => router.refresh(), intervalMs)
    }
    const stoppen = () => {
      if (id === null) return
      clearInterval(id)
      id = null
    }

    const beiSichtbarkeitswechsel = () => {
      if (document.visibilityState === 'visible') {
        router.refresh() // beim Zurückkehren sofort aktuellen Stand holen, nicht bis zu 60s warten
        starten()
      } else {
        stoppen()
      }
    }

    if (document.visibilityState === 'visible') starten()
    document.addEventListener('visibilitychange', beiSichtbarkeitswechsel)

    return () => {
      stoppen()
      document.removeEventListener('visibilitychange', beiSichtbarkeitswechsel)
    }
  }, [router, intervalMs])

  return null
}
