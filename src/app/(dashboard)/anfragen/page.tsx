import { getKundenAnfragen } from '@/lib/supabase/queries'
import { AnfragenListe } from '@/components/anfragen/AnfragenListe'

// Ohne diese Zeile: die Seite liest an keiner Stelle searchParams/params/cookies/headers, also
// stuft Next.js (Next 16, "Previous Model" ohne cacheComponents — next.config.ts bestätigt das)
// die komplette Route als statisch einstufbar ein und rendert sie NUR BEIM DEPLOY einmal, liefert
// danach immer dieselbe eingefrorene Momentaufnahme aus — unabhängig davon, wie viele neue
// Anfragen seitdem in der DB dazukommen. Das erklärt genau den gemeldeten Bug: Badge (läuft über
// eine Server Action, nie vom Route-Cache betroffen) zeigt 24 offene Anfragen live korrekt an,
// während die Tabelle hier den Stand vom letzten Deploy zeigt (zu dem Zeitpunkt alles erledigt).
// Alle anderen Dashboard-Seiten nutzen searchParams/params und sind dadurch automatisch dynamisch
// — diese hier war die einzige ohne ein solches Signal.
export const dynamic = 'force-dynamic'

export default async function AnfragenPage() {
  const { offen, erledigt } = await getKundenAnfragen()

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          Anfragen
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 500 }}>
          {offen.length === 0 ? 'Alles erledigt' : `${offen.length} offene Anfrage${offen.length === 1 ? '' : 'n'}`} · Anliegen, die Lena am Telefon nicht direkt lösen konnte
        </p>
      </div>

      <AnfragenListe offen={offen} erledigt={erledigt} />
    </div>
  )
}
