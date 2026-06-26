'use client'

export function DruckenButton() {
  return (
    <button
      onClick={() => window.print()}
      className="min-h-[48px] px-5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors print:hidden"
    >
      Drucken
    </button>
  )
}
