import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--color-sidebar-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Freizo
          </div>
          <div style={{ fontSize: '0.75rem', color: '#A5B4FC', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '8px' }}>
            Upsalla Kinderpark · Wuppertal
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'var(--color-surface)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          }}
        >
          <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--color-text)' }}>
            Mitarbeiter-Login
          </h2>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
