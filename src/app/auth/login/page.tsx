import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'var(--color-sidebar-bg)' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/freizo-logo-white.png"
            alt="Freizo"
            style={{ width: '200px', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Slogan für externe Besucher */}
        <div className="text-center mb-8">
          <p style={{ fontSize: '0.78rem', color: '#818CF8', fontWeight: 500, letterSpacing: '0.04em' }}>
            Reservierungssystem für Freizeitanlagen
          </p>
        </div>

        {/* Login Card */}
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

        {/* Kontakt für externe Besucher */}
        <div className="text-center mt-8" style={{ color: '#4C5B8A', fontSize: '0.75rem' }}>
          <p>Upsalla Kinderpark Wuppertal</p>
          <p style={{ marginTop: '4px' }}>
            Interesse an Freizo?{' '}
            <a
              href="mailto:valeriuleo@gmail.com"
              style={{ color: '#818CF8', textDecoration: 'underline' }}
            >
              Kontakt aufnehmen
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}
