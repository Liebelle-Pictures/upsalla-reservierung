import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { getOffeneAnfragenAnzahl } from '@/app/actions/anfragen'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const offeneAnfragen = await getOffeneAnfragenAnzahl()

  return (
    <div className="flex h-full" style={{ background: 'var(--color-bg)' }}>
      <Sidebar offeneAnfragen={offeneAnfragen} />
      <main
        className="flex-1 overflow-y-auto"
        style={{ padding: '32px 32px 88px', minWidth: 0 }}
      >
        {children}
      </main>
      <MobileNav offeneAnfragen={offeneAnfragen} />
    </div>
  )
}
