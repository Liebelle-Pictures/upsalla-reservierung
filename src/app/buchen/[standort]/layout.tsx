// Öffentliches Layout der Online-Buchung: Upsalla-Rahmen statt Staff-Sidebar.
// Gilt auch für /erfolg und /abgebrochen.
import type { Metadata, Viewport } from 'next'
import { OeffentlicherRahmen } from '@/components/buchen/OeffentlicherRahmen'

export const metadata: Metadata = {
  title: 'Kindergeburtstag online buchen · Upsalla Kinderpark Wuppertal',
  description: 'Bucht euren Kindergeburtstag im Upsalla Kinderpark Wuppertal direkt online.',
  robots: { index: false },
}

export const viewport: Viewport = {
  themeColor: '#c8e7f5',
  width: 'device-width',
  initialScale: 1,
}

export default function BuchenLayout({ children }: LayoutProps<'/buchen/[standort]'>) {
  return <OeffentlicherRahmen>{children}</OeffentlicherRahmen>
}
