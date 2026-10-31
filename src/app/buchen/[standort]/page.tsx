// Öffentliches Buchungs-Widget /buchen/[standort] (z. B. /buchen/upsalla).
// Server Component: prüft den Standort (sonst 404) und gibt das Buchungsfenster an den
// Wizard (Client Component) weiter. Siehe docs/module/online-buchung.md, 5.6.
import { notFound } from 'next/navigation'
import { ladeOnlineStandort } from '@/lib/online-buchung/standort'
import { buchungsfenster } from '@/lib/online-buchung/validierung'
import { BuchungsWizard } from '@/components/buchen/BuchungsWizard'

export const dynamic = 'force-dynamic'

export default async function BuchenPage(props: PageProps<'/buchen/[standort]'>) {
  const { standort: slug } = await props.params
  const standort = await ladeOnlineStandort(slug)
  if (!standort) notFound()

  const fenster = buchungsfenster()
  return <BuchungsWizard slug={standort.slug} ersterMonat={fenster.von.slice(0, 7)} letzterMonat={fenster.bis.slice(0, 7)} />
}
