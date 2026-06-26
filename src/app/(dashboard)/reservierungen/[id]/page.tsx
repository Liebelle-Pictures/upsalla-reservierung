import { notFound } from 'next/navigation'
import { getReservierung } from '@/lib/supabase/queries'
import { ReservierungDetailView } from '@/components/reservierungen/ReservierungDetailView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReservierungDetailPage({ params }: Props) {
  const { id } = await params
  const reservierung = await getReservierung(id)

  if (!reservierung) notFound()

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Reservierung</h1>
      <ReservierungDetailView reservierung={reservierung} />
    </div>
  )
}
