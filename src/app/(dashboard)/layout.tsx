import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full" style={{ background: 'var(--color-bg)' }}>
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto"
        style={{ padding: '32px 32px 88px', minWidth: 0 }}
      >
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
