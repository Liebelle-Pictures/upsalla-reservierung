import type { ReactNode } from 'react'

interface Props {
  farbe: 'gruen' | 'gelb' | 'rot' | 'blau' | 'grau'
  children: ReactNode
}

const FARBEN = {
  gruen: 'bg-green-100 text-green-800',
  gelb: 'bg-yellow-100 text-yellow-800',
  rot: 'bg-red-100 text-red-800',
  blau: 'bg-blue-100 text-blue-800',
  grau: 'bg-gray-100 text-gray-800',
}

export function Badge({ farbe, children }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${FARBEN[farbe]}`}>
      {children}
    </span>
  )
}
