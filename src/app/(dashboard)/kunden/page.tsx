import { Suspense } from 'react'
import { getAlleKunden } from '@/lib/supabase/queries'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { KundenListe } from '@/components/kunden/KundenListe'
import { KundenSuche } from '@/components/kunden/KundenSuche'

interface Props {
  searchParams: Promise<{ suche?: string }>
}

export default async function KundenPage({ searchParams }: Props) {
  const { suche } = await searchParams
  const kunden = await getAlleKunden(WUPPERTAL_STANDORT_ID, suche)

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          Kundendatenbank
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 500 }}>
          {kunden.length} Kunden
        </p>
      </div>

      <Suspense>
        <KundenSuche />
      </Suspense>

      <KundenListe kunden={kunden as Parameters<typeof KundenListe>[0]['kunden']} />
    </div>
  )
}
