'use client'
// Cloudflare Turnstile (Bot-Schutz) für die Online-Buchung. Modus „interaction-only“:
// meist unsichtbar, nur bei Verdacht erscheint ein kurzes Kästchen.
// Token sind einmalig gültig und laufen nach ~5 Min. ab → nach jedem Absenden
// remountet der Wizard die Komponente (neuer key) und bekommt ein neues Token.
import { useEffect, useRef } from 'react'

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

const SKRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let skriptLaden: Promise<TurnstileApi> | null = null
function ladeSkript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!skriptLaden) {
    skriptLaden = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SKRIPT_URL
      s.async = true
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile fehlt')))
      s.onerror = () => { skriptLaden = null; reject(new Error('Turnstile-Skript nicht geladen')) }
      document.head.appendChild(s)
    })
  }
  return skriptLaden
}

export function Turnstile({ onToken, onFehler }: { onToken: (token: string | null) => void; onFehler: (hinweis: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // Callbacks über Ref, damit das Widget bei neuen Funktionsreferenzen nicht neu gerendert wird
  const cb = useRef({ onToken, onFehler })
  useEffect(() => { cb.current = { onToken, onFehler } })

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return
    let widgetId: string | null = null
    let aktiv = true
    ladeSkript().then(api => {
      if (!aktiv || !ref.current) return
      widgetId = api.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: 'online-buchung',
        appearance: 'interaction-only',
        language: 'de',
        callback: (token: string) => cb.current.onToken(token),
        'expired-callback': () => cb.current.onToken(null),
        'error-callback': () => {
          cb.current.onToken(null)
          cb.current.onFehler('Die Sicherheitsprüfung konnte nicht geladen werden. Bitte ladet die Seite neu.')
        },
      })
    }).catch(() => cb.current.onFehler('Die Sicherheitsprüfung konnte nicht geladen werden. Bitte prüft eure Internetverbindung und ladet die Seite neu.'))
    return () => {
      aktiv = false
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={ref} className="mt-4 flex justify-center" />
}
