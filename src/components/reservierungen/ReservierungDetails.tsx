'use client'

import type { Reservierung } from '@/types'

interface Props {
  reservierung: Reservierung
}

export function ReservierungDetails({ reservierung }: Props) {
  return (
    <div className="space-y-4">
      <div>Status: {reservierung.status}</div>
      <div>Kinder: {reservierung.kinder_anzahl}</div>
      <div>Betrag: {reservierung.gesamtbetrag} €</div>
      <div>Anzahlung: {reservierung.anzahlung_betrag} €</div>
    </div>
  )
}
