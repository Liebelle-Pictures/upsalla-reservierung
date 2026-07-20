'use client'

import Link from 'next/link'
import Image from 'next/image'
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      className="hidden md:flex flex-col min-h-screen"
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--color-sidebar-bg)',
        flexShrink: 0,
      }}
    >
      {/* Logo Freizo */}
      <div style={{ padding: '28px 20px 24px' }}>
        <div>
          <Image
            src="/freizo-logo-white.png"
            alt="Freizo"
            width={130}
            height={45}
            priority
            style={{ objectFit: 'contain' }}
          />
          <div
            style={{
              fontSize: '0.7rem',
              color: '#A5B4FC',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: '6px',
            }}
          >
            Upsalla · Wuppertal
          </div>
        </div>
      </div>

      {/* Separator */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 20px 12px' }} />

      {/* Navigation */}
      <div style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_LINKS.map(({ href, label, icon }) => {
          const aktiv = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold min-h-[44px]"
              style={{
                background: aktiv ? 'var(--color-sidebar-active)' : 'transparent',
                color: aktiv ? '#FFFFFF' : '#A5B4FC',
              }}
              onMouseEnter={e => { if (!aktiv) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { if (!aktiv) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            >
              {icon}
              {label}
            </Link>
          )
        })}
      </div>

      {/* Separator */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '12px 20px 8px' }} />

      {/* Abmelden */}
      <div style={{ padding: '0 12px 24px' }}>
        <form action={abmelden}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold min-h-[44px]"
            style={{ color: '#F87171' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
