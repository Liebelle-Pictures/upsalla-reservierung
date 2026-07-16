import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'var(--accent)' }}
          >
            <span className="text-white text-2xl font-bold">U</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Upsalla Kinderpark
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Mitarbeiter-Login
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
          }}
        >
          <LoginForm />
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>
          Freizo — Reservierungssystem
        </p>
      </div>
    </div>
  )
}
