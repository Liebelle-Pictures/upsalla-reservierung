'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function KundenSuche() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const wert = e.target.value
    startTransition(() => {
      if (wert) {
        router.push(`/kunden?suche=${encodeURIComponent(wert)}`)
      } else {
        router.push('/kunden')
      }
    })
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <input
        type="search"
        defaultValue={searchParams.get('suche') ?? ''}
        onChange={handleChange}
        placeholder="Name oder Telefonnummer suchen…"
        className="w-full h-12 pl-12 pr-4 text-sm font-medium outline-none rounded-xl"
        style={{
          background: 'var(--color-surface)',
          border: '2px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      />
    </div>
  )
}
