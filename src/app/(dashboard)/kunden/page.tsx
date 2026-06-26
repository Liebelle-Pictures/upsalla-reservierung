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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          Kundendatenbank
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({kunden.length})
          </span>
        </h1>
      </div>

      <Suspense>
        <KundenSuche />
      </Suspense>

      <KundenListe kunden={kunden as Parameters<typeof KundenListe>[0]['kunden']} />
    </div>
  )
}
