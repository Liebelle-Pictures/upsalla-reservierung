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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
            Reservierungen
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 500 }}>
            {reservierungen.length} Einträge
          </p>
        </div>
        <Link
          href="/reservierungen/neu"
          className="h-11 px-5 flex items-center rounded-xl text-white font-bold"
          style={{ background: 'var(--color-primary)', fontSize: '0.9rem' }}
        >
          + Neue Reservierung
        </Link>
      </div>

      <StatusFilter aktiv={aktiverFilter} />

      <ReservierungListe reservierungen={reservierungen as unknown as Parameters<typeof ReservierungListe>[0]['reservierungen']} />
    </div>
  )
}
