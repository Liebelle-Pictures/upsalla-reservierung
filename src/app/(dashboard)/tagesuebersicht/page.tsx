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
    <>
      <style>{`
        @media print {
          @page { margin: 15mm 12mm; size: A4 portrait; }
          body { background: white !important; }
          nav, aside, header { display: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* Navigation + Drucken — wird beim Drucken ausgeblendet */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <div className="flex-1">
          <DatumNavigator datum={datum} basePath="/tagesuebersicht" />
        </div>
        <DruckenButton />
      </div>

      {/* Druckbarer Bereich */}
      <div style={{ background: '#ffffff', padding: '0' }}>

        {/* Kopfzeile */}
        <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E1B4B', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                Upsalla Kinderpark Wuppertal
              </div>
              <div style={{ fontSize: '0.95rem', color: '#6366F1', fontWeight: 600, marginTop: '4px' }}>
                Tagesübersicht — {datumAnzeige}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748B', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: '#1E293B' }}>
                {reservierungen.length} Reservierung{reservierungen.length !== 1 ? 'en' : ''}
              </div>
              <div className="print:block hidden">
                Gedruckt: {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            </div>
          </div>
        </div>

        <TagesuebersichtTabelle
          reservierungen={reservierungen as unknown as Parameters<typeof TagesuebersichtTabelle>[0]['reservierungen']}
        />
      </div>
    </>
  )
}
