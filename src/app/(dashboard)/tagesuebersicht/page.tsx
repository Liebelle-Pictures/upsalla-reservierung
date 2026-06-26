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
      <div className="bg-white rounded-xl border border-gray-100 p-6 print:border-0 print:p-0 print:rounded-none">
        {/* Kopfzeile für den Druck */}
        <div className="mb-6 print:mb-4">
          <div className="flex items-center justify-between print:mb-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900 print:text-2xl">
                Upsalla Kinderpark Wuppertal
              </h1>
              <p className="text-gray-500 text-sm print:text-base">Tagesübersicht — {datumAnzeige}</p>
            </div>
            <div className="text-right text-sm text-gray-400 print:text-gray-600">
              <div>{reservierungen.length} Reservierung{reservierungen.length !== 1 ? 'en' : ''}</div>
              <div className="print:block hidden">
                Gedruckt: {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            </div>
          </div>
          <hr className="mt-3 border-gray-200" />
        </div>

        <TagesuebersichtTabelle
          reservierungen={reservierungen as Parameters<typeof TagesuebersichtTabelle>[0]['reservierungen']}
        />
      </div>
    </div>
  )
}
