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
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Reservierungen
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {reservierungen.length} Einträge
          </p>
        </div>
        <Link
          href="/reservierungen/neu"
          className="h-11 px-5 flex items-center rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          + Neue Reservierung
        </Link>
      </div>

      <StatusFilter aktiv={aktiverFilter} />

      <ReservierungListe reservierungen={reservierungen as unknown as Parameters<typeof ReservierungListe>[0]['reservierungen']} />
    </div>
  )
}
