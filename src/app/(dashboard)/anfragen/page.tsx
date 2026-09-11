import { getKundenAnfragen } from '@/lib/supabase/queries'
import { AnfragenListe } from '@/components/anfragen/AnfragenListe'

export default async function AnfragenPage() {
  const anfragen = await getKundenAnfragen()
  const offen = anfragen.filter(a => a.status === 'OFFEN').length

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          Anfragen
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 500 }}>
          {offen === 0 ? 'Alles erledigt' : `${offen} offene Anfrage${offen === 1 ? '' : 'n'}`} · Anliegen, die Lena am Telefon nicht direkt lösen konnte
        </p>
      </div>

      <AnfragenListe anfragen={anfragen} />
    </div>
  )
}
