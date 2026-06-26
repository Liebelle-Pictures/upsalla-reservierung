import { getAlleReservierungen } from '@/lib/supabase/queries'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { ReservierungListe } from '@/components/reservierungen/ReservierungListe'
import { StatusFilter } from '@/components/reservierungen/StatusFilter'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function ReservierungenListePage({ searchParams }: Props) {
  const { status } = await searchParams
  const aktiverFilter = status ?? 'ALLE'

  const reservierungen = await getAlleReservierungen(
    WUPPERTAL_STANDORT_ID,
    aktiverFilter,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          Reservierungen
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({reservierungen.length})
          </span>
        </h1>
        <Link
          href="/reservierungen/neu"
          className="min-h-[48px] px-4 flex items-center bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
        >
          + Neue Reservierung
        </Link>
      </div>

      <StatusFilter aktiv={aktiverFilter} />

      <ReservierungListe reservierungen={reservierungen as unknown as Parameters<typeof ReservierungListe>[0]['reservierungen']} />
    </div>
  )
}
