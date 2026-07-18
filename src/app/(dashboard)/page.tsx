import { Suspense } from 'react'
import { getLogen, getReservierungenFuerTag } from '@/lib/supabase/queries'
import { getVerfuegbareSlots } from '@/lib/utils/zeitslots'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { KalenderGrid } from '@/components/kalender/KalenderGrid'
import { DatumNavigator } from '@/components/kalender/DatumNavigator'
import { KalenderSkeleton } from '@/components/kalender/KalenderSkeleton'
import { AutoRefresh } from '@/components/kalender/AutoRefresh'

interface Props {
  searchParams: Promise<{ datum?: string }>
}

async function Kalender({ datum }: { datum: string }) {
  const datumObj = new Date(datum + 'T00:00:00')
  const [logen, reservierungen, teuerterTag] = await Promise.all([
    getLogen(WUPPERTAL_STANDORT_ID),
    getReservierungenFuerTag(datum, WUPPERTAL_STANDORT_ID),
    istPreisteuerterTag(datumObj),
  ])

  const zeitslots = getVerfuegbareSlots(datumObj, teuerterTag)

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
    <>
      <AutoRefresh intervalMs={30000} />
      <DatumNavigator datum={datum} />
      <Suspense fallback={<KalenderSkeleton />}>
        <Kalender datum={datum} />
      </Suspense>
    </>
  )
}
