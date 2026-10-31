// Ziel von cancel_url der Lena-/Personal-Zahlungslinks (vorher 404). Ändert keine Daten:
// der Link bleibt bis zum Ablauf (24h) gültig und kann erneut geöffnet werden.
import { StatusKarte } from '@/components/buchen/StatusKarte'

export const metadata = { title: 'Zahlung abgebrochen · Upsalla Kinderpark Wuppertal' }

export default function ZahlungAbgebrochenPage() {
  return (
    <StatusKarte ton="hinweis" titel="Zahlung abgebrochen">
      <p>Ihr habt die Zahlung abgebrochen, es wurde nichts abgebucht.</p>
      <p>
        Euer Zahlungslink aus der SMS bzw. E-Mail bleibt bis zum angegebenen Zeitpunkt gültig.
        Öffnet ihn einfach erneut, um die Anzahlung zu bezahlen.
      </p>
      <p className="text-sm text-gray-500">Fragen? Ruft uns an: <strong>0202 2623339</strong></p>
    </StatusKarte>
  )
}
