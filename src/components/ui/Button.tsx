import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primaer' | 'sekundaer' | 'gefahr'
}

const VARIANTEN = {
  primaer: 'bg-blue-600 text-white hover:bg-blue-700',
  sekundaer: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  gefahr: 'bg-red-500 text-white hover:bg-red-600',
}

export function Button({ variante = 'primaer', className = '', children, ...props }: Props) {
  return (
    <button
      className={`min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg font-medium transition-colors ${VARIANTEN[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
