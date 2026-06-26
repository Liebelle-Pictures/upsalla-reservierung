'use client'

import { useActionState } from 'react'
import { anmelden, type LoginState } from '@/app/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(anmelden, undefined)

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="mitarbeiter@upsalla.de"
        />
      </div>

      <div>
        <label htmlFor="passwort" className="block text-sm font-medium text-gray-700 mb-1">
          Passwort
        </label>
        <input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="current-password"
          required
          className="w-full h-12 px-4 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>

      {state?.fehler && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          {state.fehler}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? 'Anmelden…' : 'Anmelden'}
      </button>
    </form>
  )
}
