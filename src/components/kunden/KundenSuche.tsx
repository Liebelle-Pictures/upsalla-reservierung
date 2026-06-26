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
    <input
      type="search"
      defaultValue={searchParams.get('suche') ?? ''}
      onChange={handleChange}
      placeholder="Name oder Telefonnummer suchen…"
      className="w-full h-12 px-4 border border-gray-200 rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}
