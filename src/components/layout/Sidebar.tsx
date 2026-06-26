'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { abmelden } from '@/app/actions/auth'

const NAV_LINKS = [
  { href: '/',                label: 'Tagesansicht' },
  { href: '/kalender',        label: 'Kalender' },
  { href: '/reservierungen',  label: 'Reservierungen' },
  { href: '/kunden',          label: 'Kunden' },
  { href: '/tagesuebersicht', label: 'Tagesübersicht' },
  { href: '/lena-statistik',  label: 'Lena Statistik' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r p-4">
      <div className="font-bold text-lg mb-6 px-3">Upsalla</div>

      <div className="flex-1 flex flex-col gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const aktiv = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`min-h-[48px] flex items-center px-3 rounded-lg text-sm font-medium transition-colors ${
                aktiv
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Logout */}
      <form action={abmelden} className="mt-4 pt-4 border-t border-gray-100">
        <button
          type="submit"
          className="w-full min-h-[48px] flex items-center px-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Abmelden
        </button>
      </form>
    </nav>
  )
}
