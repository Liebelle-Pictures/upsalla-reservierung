import { notFound } from 'next/navigation'
import { getLoge } from '@/lib/supabase/queries'
import { getVerfuegbareSlots } from '@/lib/utils/zeitslots'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { ReservierungFormClient } from '@/components/reservierungen/ReservierungFormClient'

interface Props {
  searchParams: Promise<{ datum?: string; loge_id?: string; zeitslot?: string }>
}

export default async function NeueReservierungPage({ searchParams }: Props) {
  const { datum, loge_id, zeitslot } = await searchParams

  if (!datum || !loge_id || !zeitslot) notFound()

  const loge = await getLoge(loge_id)
  if (!loge) notFound()

  const datumObj = new Date(datum + 'T00:00:00')
  const teuerterTag = await istPreisteuerterTag(datumObj)
  const slots = getVerfuegbareSlots(datumObj, teuerterTag)
  const slot = slots.find((s) => s.nummer === Number(zeitslot))
  if (!slot) notFound()

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Neue Reservierung</h1>
      <ReservierungFormClient datum={datum} loge={loge} slot={slot} istTeuerterTag={teuerterTag} />
    </div>
  )
}
