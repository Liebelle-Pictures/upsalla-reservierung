'use client'

import { useActionState } from 'react'
import { anmelden, type LoginState } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(anmelden, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm mb-1.5"
          style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}
        >
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full h-12 px-4 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--color-bg)',
            border: '2px solid var(--color-border)',
            color: 'var(--color-text)',
            fontWeight: 500,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          placeholder="mitarbeiter@upsalla.de"
        />
      </div>

      <div>
        <label
          htmlFor="passwort"
          className="block text-sm mb-1.5"
          style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}
        >
          Passwort
        </label>
        <input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="current-password"
          required
          className="w-full h-12 px-4 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--color-bg)',
            border: '2px solid var(--color-border)',
            color: 'var(--color-text)',
            fontWeight: 500,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          placeholder="••••••••"
        />
      </div>

      {state?.fehler && (
        <div
          className="px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#FFF1F0', color: '#B91C1C', border: '1px solid #FECACA' }}
        >
          {state.fehler}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 rounded-xl font-bold text-white mt-2"
        style={{
          background: pending ? 'var(--color-border)' : 'var(--color-primary)',
          cursor: pending ? 'not-allowed' : 'pointer',
          fontSize: '0.95rem',
        }}
      >
        {pending ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  )
}
