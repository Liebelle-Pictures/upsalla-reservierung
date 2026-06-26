'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { abmelden } from '@/app/actions/auth'

export function MobileNav() {
  const pathname = usePathname()

  const linkClass = (href: string) => {
    const aktiv = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return `flex flex-col items-center min-w-[48px] min-h-[48px] justify-center text-xs font-medium transition-colors ${
      aktiv ? 'text-blue-600' : 'text-gray-500'
    }`
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-10">
      <Link href="/" className={linkClass('/')}>Heute</Link>
      <Link href="/kalender" className={linkClass('/kalender')}>Kalender</Link>
      <Link href="/reservierungen" className={linkClass('/reservierungen')}>Buchungen</Link>
      <Link href="/kunden" className={linkClass('/kunden')}>Kunden</Link>
      <form action={abmelden}>
        <button
          type="submit"
          className="flex flex-col items-center min-w-[48px] min-h-[48px] justify-center text-xs font-medium text-red-500"
        >
          Logout
        </button>
      </form>
    </nav>
  )
}
