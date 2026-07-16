'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { abmelden } from '@/app/actions/auth'

const NAV_LINKS = [
  {
    href: '/',
    label: 'Heute',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    href: '/kalender',
    label: 'Kalender',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/reservierungen',
    label: 'Reservierungen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    href: '/kunden',
    label: 'Kunden',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/tagesuebersicht',
    label: 'Tagesübersicht',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"/>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>
    ),
  },
  {
    href: '/lena-statistik',
    label: 'Lena KI',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
        <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      className="hidden md:flex flex-col min-h-screen border-r"
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'var(--accent)' }}
          >
            U
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Upsalla
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              Kinderpark
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 flex-1 flex flex-col gap-0.5">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const aktiv = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]"
              style={{
                color: aktiv ? 'var(--accent)' : 'var(--text-secondary)',
                background: aktiv ? 'var(--accent-light)' : 'transparent',
              }}
            >
              <span style={{ opacity: aktiv ? 1 : 0.7 }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Logout */}
      <div className="px-3 pb-6 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <form action={abmelden}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]"
            style={{ color: 'var(--status-red)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Abmelden
          </button>
        </form>
      </div>
    </nav>
  )
}
