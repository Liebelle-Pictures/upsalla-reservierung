import { notFound } from 'next/navigation'
import { getReservierung } from '@/lib/supabase/queries'
import { istPreisteuerterTag } from '@/lib/utils/feiertage'
import { ReservierungBearbeitenForm } from '@/components/reservierungen/ReservierungBearbeitenForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReservierungBearbeitenPage({ params }: Props) {
  const { id } = await params
  const reservierung = await getReservierung(id)

  if (!reservierung) notFound()
  if (reservierung.status === 'STORNIERT') notFound()

  const teuerterTag = await istPreisteuerterTag(new Date(reservierung.datum + 'T00:00:00'))

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Reservierung bearbeiten</h1>
      <ReservierungBearbeitenForm
        reservierung={reservierung as Parameters<typeof ReservierungBearbeitenForm>[0]['reservierung']}
        istTeuerterTag={teuerterTag}
      />
    </div>
  )
}
