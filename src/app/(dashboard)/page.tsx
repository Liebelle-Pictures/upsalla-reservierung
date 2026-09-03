import { Suspense } from 'react'
import { getLogen, getReservierungenFuerTag } from '@/lib/supabase/queries'
import { getVerfuegbareSlots, getSchliesstagName } from '@/lib/utils/zeitslots'
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

  if (zeitslots.length === 0) {
    const schliesstag = getSchliesstagName(datumObj)
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl py-24"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
          Geschlossen{schliesstag ? ` — ${schliesstag}` : ''}
        </p>
        <p style={{ color: 'var(--color-text-muted)' }}>An diesem Tag sind keine Reservierungen möglich.</p>
      </div>
    )
  }

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
