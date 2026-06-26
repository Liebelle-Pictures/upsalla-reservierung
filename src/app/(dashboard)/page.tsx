import { Suspense } from 'react'
import { getLogen, getReservierungenFuerTag } from '@/lib/supabase/queries'
import { getVerfuegbareSlots } from '@/lib/utils/zeitslots'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { KalenderGrid } from '@/components/kalender/KalenderGrid'
import { DatumNavigator } from '@/components/kalender/DatumNavigator'
import { KalenderSkeleton } from '@/components/kalender/KalenderSkeleton'

interface Props {
  searchParams: Promise<{ datum?: string }>
}

async function Kalender({ datum }: { datum: string }) {
  const [logen, reservierungen] = await Promise.all([
    getLogen(WUPPERTAL_STANDORT_ID),
    getReservierungenFuerTag(datum, WUPPERTAL_STANDORT_ID),
  ])

  const zeitslots = getVerfuegbareSlots(new Date(datum + 'T00:00:00'))

  return (
    <KalenderGrid
      datum={datum}
      logen={logen}
      reservierungen={reservierungen}
      zeitslots={zeitslots}
    />
  )
}

export default async function TagesansichtPage({ searchParams }: Props) {
  const { datum: datumParam } = await searchParams
  const datum = datumParam ?? new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <DatumNavigator datum={datum} />
      <Suspense fallback={<KalenderSkeleton />}>
        <Kalender datum={datum} />
      </Suspense>
    </div>
  )
}
