'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { anfrageErledigt } from '@/app/actions/anfragen'
import type { KundenAnfrage } from '@/lib/supabase/queries'

interface Props {
  anfragen: KundenAnfrage[]
}

export function AnfragenListe({ anfragen }: Props) {
  const [pending, startTransition] = useTransition()

  if (anfragen.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-24 rounded-2xl"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>Noch keine Anfragen.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {anfragen.map(a => {
        const erledigt = a.status === 'ERLEDIGT'
        const zeit = new Date(a.erstellt_am).toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        const name = [a.vorname, a.nachname].filter(Boolean).join(' ')

        return (
          <div
            key={a.id}
            className="w-full p-4 rounded-xl"
            style={{
              background: erledigt ? 'var(--color-bg)' : 'var(--color-surface)',
              border: erledigt ? '1.5px solid var(--color-border)' : '1.5px solid #FED7AA',
              opacity: erledigt ? 0.6 : 1,
              boxShadow: erledigt ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium" style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                  {a.anliegen}
                </p>
                <div className="text-sm flex gap-3 flex-wrap mt-2 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {name && <span>{name}</span>}
                  {a.telefon && <span>{a.telefon}</span>}
                  <span>{zeit} Uhr</span>
                  {a.reservierung_id && (
                    <Link href={`/reservierungen/${a.reservierung_id}`} className="underline" style={{ color: 'var(--color-primary)' }}>
                      Zur Reservierung
                    </Link>
                  )}
                </div>
              </div>

              {!erledigt && (
                <button
                  onClick={() => startTransition(async () => {
                    await anfrageErledigt(a.id)
                    window.dispatchEvent(new Event('anfragen-aktualisiert'))
                  })}
                  disabled={pending}
                  className="shrink-0 h-10 px-4 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#EA580C', color: '#fff' }}
                >
                  Erledigt
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
