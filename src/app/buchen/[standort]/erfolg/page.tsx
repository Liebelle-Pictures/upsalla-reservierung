// Rückkehr von Stripe nach der Zahlung (success_url der Online-Buchung).
// Normalerweise hat der Webhook die Buchung schon bestätigt. Falls nicht (verzögert oder
// ausgefallen), wird es hier nachgeholt — idempotent, SMS/E-Mail gehen trotzdem nur einmal raus.
import { notFound } from 'next/navigation'
import { ladeOnlineStandort } from '@/lib/online-buchung/standort'
import { ladeOnlineCheckout, euro } from '@/lib/online-buchung/checkout'
import { markiereOnlineBuchungBezahlt, bestaetigeOnlineBuchung } from '@/lib/online-buchung/bestaetigung'
import { StatusKarte, Zusammenfassung, KnopfLink } from '@/components/buchen/StatusKarte'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Buchung · Upsalla Kinderpark Wuppertal', robots: { index: false } }

const NEULADEN_SEKUNDEN = 4
// Danach nicht mehr automatisch neu laden (verzögerte Zahlungen können Tage dauern)
const MAX_NEULADEN = 5

export default async function ErfolgPage(props: PageProps<'/buchen/[standort]/erfolg'>) {
  const { standort: slug } = await props.params
  const { session_id, versuch } = await props.searchParams
  const versuchNr = Math.min(Math.max(Number(typeof versuch === 'string' ? versuch : 0) || 0, 0), MAX_NEULADEN)
  const standort = await ladeOnlineStandort(slug)
  if (!standort) notFound()

  const checkout = await ladeOnlineCheckout(standort.id, typeof session_id === 'string' ? session_id : undefined)
  if (!checkout) {
    return (
      <StatusKarte ton="fehler" titel="Buchung nicht gefunden">
        <p>Wir konnten diese Zahlung keiner Buchung zuordnen. Bitte ruft uns an: <strong>0202 2623339</strong></p>
      </StatusKarte>
    )
  }
  const { session, reservierung: r } = checkout

  if (session.payment_status === 'paid') {
    if (r.status !== 'BESTAETIGT_BEZAHLT') {
      const ergebnis = await markiereOnlineBuchungBezahlt(r.id, (session.payment_intent as string) ?? null, new Date())
      if (ergebnis !== 'FEHLER' && ergebnis !== 'KEINE_ONLINE_BUCHUNG') {
        await bestaetigeOnlineBuchung(r.id, session.customer_details?.email ?? null)
      }
    }
    return (
      <StatusKarte ton="erfolg" titel="Euer Termin ist fix!">
        <p>Danke! Eure Anzahlung ist eingegangen.</p>
        <Zusammenfassung zeilen={[
          ['Datum', checkout.datumAnzeige],
          ['Uhrzeit', checkout.uhrzeit],
          ['Loge', r.logeName],
          ['Kinder / Erwachsene', `${r.kinder_anzahl} / ${r.erwachsene_anzahl}`],
          ['Anzahlung bezahlt', euro(r.anzahlung_betrag)],
          ['Restbetrag vor Ort', euro(r.gesamtbetrag - r.anzahlung_betrag)],
        ]} />
        <p>Die Bestätigung kommt per SMS und E-Mail.</p>
        <p className="text-sm text-gray-500">Fragen? Ruft uns an: <strong>0202 2623339</strong></p>
      </StatusKarte>
    )
  }

  if (session.status === 'complete') {
    // Zahlung abgeschickt, aber noch nicht bestätigt → einige Male automatisch neu laden,
    // danach Abschlusstext (Bestätigung kommt dann per SMS/E-Mail über den Webhook).
    if (versuchNr < MAX_NEULADEN) {
      const naechste = `/buchen/${standort.slug}/erfolg?session_id=${encodeURIComponent(session.id)}&versuch=${versuchNr + 1}`
      return (
        <StatusKarte ton="warten" titel="Zahlung wird bestätigt…">
          <meta httpEquiv="refresh" content={`${NEULADEN_SEKUNDEN};url=${naechste}`} />
          <p>Einen Moment bitte, wir warten auf die Bestätigung eurer Zahlung. Die Seite lädt sich automatisch neu.</p>
        </StatusKarte>
      )
    }
    return (
      <StatusKarte ton="warten" titel="Zahlung wird bearbeitet">
        <p>Eure Zahlung wird bearbeitet. Sobald sie bestätigt ist, bekommt ihr SMS und E-Mail.</p>
        <p className="text-sm text-gray-500">Fragen? Ruft uns an: <strong>0202 2623339</strong></p>
      </StatusKarte>
    )
  }

  return (
    <StatusKarte ton="fehler" titel="Zahlung nicht abgeschlossen">
      <p>Die Anzahlung wurde nicht bezahlt, deshalb ist der Termin nicht gebucht.</p>
      <KnopfLink href={`/buchen/${standort.slug}`}>Neuen Termin wählen</KnopfLink>
    </StatusKarte>
  )
}
