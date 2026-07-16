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
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full h-12 px-4 rounded-xl text-base outline-none transition-all"
          style={{
            background: 'var(--bg)',
            border: '1.5px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          placeholder="mitarbeiter@upsalla.de"
        />
      </div>

      <div>
        <label
          htmlFor="passwort"
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Passwort
        </label>
        <input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="current-password"
          required
          className="w-full h-12 px-4 rounded-xl text-base outline-none transition-all"
          style={{
            background: 'var(--bg)',
            border: '1.5px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          placeholder="••••••••"
        />
      </div>

      {state?.fehler && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: '#FFF1F0', color: 'var(--status-red)', border: '1px solid #FECACA' }}
        >
          {state.fehler}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 rounded-xl font-semibold text-white transition-all mt-2"
        style={{
          background: pending ? 'var(--border-strong)' : 'var(--accent)',
          cursor: pending ? 'not-allowed' : 'pointer',
        }}
      >
        {pending ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  )
}
