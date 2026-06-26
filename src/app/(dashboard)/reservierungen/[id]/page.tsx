import { notFound } from 'next/navigation'
import { getReservierung } from '@/lib/supabase/queries'
import { ReservierungDetailView } from '@/components/reservierungen/ReservierungDetailView'
import { verifizierteZahlung } from '@/app/actions/reservierungen'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ zahlung?: string; session_id?: string }>
}

export default async function ReservierungDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { zahlung, session_id } = await searchParams

  // Zahlung direkt über Stripe API verifizieren (kein Webhook nötig)
  if (zahlung === 'erfolg' && session_id) {
    await verifizierteZahlung(id, session_id)
  }

  const reservierung = await getReservierung(id)

  if (!reservierung) notFound()

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Reservierung</h1>
      <ReservierungDetailView reservierung={reservierung} />
    </div>
  )
}
