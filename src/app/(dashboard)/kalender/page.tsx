import { getReservierungenFuerMonat } from '@/lib/supabase/queries'
import { WUPPERTAL_STANDORT_ID } from '@/lib/config'
import { MonatsNavigator } from '@/components/kalender/MonatsNavigator'
import { MonatsKalender } from '@/components/kalender/MonatsKalender'

interface Props {
  searchParams: Promise<{ jahr?: string; monat?: string }>
}

export default async function KalenderPage({ searchParams }: Props) {
  const { jahr: jahrParam, monat: monatParam } = await searchParams
  const heute = new Date()
  const jahr = jahrParam ? parseInt(jahrParam) : heute.getFullYear()
  const monat = monatParam ? parseInt(monatParam) : heute.getMonth() + 1

  const reservierungen = await getReservierungenFuerMonat(jahr, monat, WUPPERTAL_STANDORT_ID)

  return (
    <div className="space-y-4">
      <MonatsNavigator jahr={jahr} monat={monat} />
      <MonatsKalender jahr={jahr} monat={monat} reservierungen={reservierungen} />
    </div>
  )
}
