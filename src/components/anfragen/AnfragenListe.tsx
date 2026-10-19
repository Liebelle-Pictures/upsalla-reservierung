'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { anfrageErledigt } from '@/app/actions/anfragen'
import type { KundenAnfrage } from '@/lib/supabase/queries'

interface Props {
  offen: KundenAnfrage[]
  erledigt: KundenAnfrage[]
}

function AnfrageKarte({ a, erledigt, pending, onErledigt }: {
  a: KundenAnfrage
  erledigt: boolean
  pending: boolean
  onErledigt: (id: string) => void
}) {
  const zeit = new Date(a.erstellt_am).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const name = [a.vorname, a.nachname].filter(Boolean).join(' ')

  return (
    <div
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
            onClick={() => onErledigt(a.id)}
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
}

export function AnfragenListe({ offen, erledigt }: Props) {
  const [pending, startTransition] = useTransition()
  const [tab, setTab] = useState<'offen' | 'archiv'>('offen')

  const handleErledigt = (id: string) => {
    startTransition(async () => {
      await anfrageErledigt(id)
      window.dispatchEvent(new Event('anfragen-aktualisiert'))
    })
  }

  const liste = tab === 'offen' ? offen : erledigt

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {([
          ['offen', `Offen (${offen.length})`],
          ['archiv', `Archiv (${erledigt.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2 text-sm font-semibold -mb-px"
            style={{
              color: tab === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: tab === key ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <div
          className="flex items-center justify-center py-24 rounded-2xl"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>
            {tab === 'offen' ? 'Keine offenen Anfragen.' : 'Noch keine erledigten Anfragen im Archiv.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {liste.map(a => (
            <AnfrageKarte
              key={a.id}
              a={a}
              erledigt={tab === 'archiv'}
              pending={pending}
              onErledigt={handleErledigt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
