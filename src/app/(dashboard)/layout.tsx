import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
