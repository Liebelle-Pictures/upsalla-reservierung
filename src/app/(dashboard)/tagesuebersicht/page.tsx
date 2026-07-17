import { getReservierungenMitDetails } from '@/lib/supabase/queries'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { DatumNavigator } from '@/components/kalender/DatumNavigator'
import { TagesuebersichtTabelle } from '@/components/tagesuebersicht/TagesuebersichtTabelle'
import { DruckenButton } from '@/components/tagesuebersicht/DruckenButton'

interface Props {
  searchParams: Promise<{ datum?: string }>
}

export default async function TagesuebersichtPage({ searchParams }: Props) {
  const { datum: datumParam } = await searchParams
  const datum = datumParam ?? new Date().toISOString().slice(0, 10)

  const reservierungen = await getReservierungenMitDetails(datum, WUPPERTAL_STANDORT_ID)

  const datumAnzeige = new Date(datum + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Navigation + Drucken — wird beim Drucken ausgeblendet */}
      <div className="flex items-center gap-4 print:hidden">
        <div className="flex-1">
          <DatumNavigator datum={datum} />
        </div>
        <DruckenButton />
      </div>

      {/* Druckbarer Bereich */}
      <div
        className="rounded-2xl p-6 print:border-0 print:p-0 print:rounded-none"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', boxShadow: '0 1px 8px rgba(99,102,241,0.05)' }}
      >
        {/* Kopfzeile */}
        <div className="mb-6 print:mb-4">
          <div className="flex items-center justify-between print:mb-2">
            <div>
              <h1
                className="print:text-2xl"
                style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}
              >
                Upsalla Kinderpark Wuppertal
              </h1>
              <p className="text-sm print:text-base font-medium" style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Tagesübersicht — {datumAnzeige}
              </p>
            </div>
            <div className="text-right text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <div>{reservierungen.length} Reservierung{reservierungen.length !== 1 ? 'en' : ''}</div>
              <div className="print:block hidden">
                Gedruckt: {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            </div>
          </div>
          <div className="mt-4" style={{ height: '1px', background: 'var(--color-border)' }} />
        </div>

        <TagesuebersichtTabelle
          reservierungen={reservierungen as unknown as Parameters<typeof TagesuebersichtTabelle>[0]['reservierungen']}
        />
      </div>
    </div>
  )
}
