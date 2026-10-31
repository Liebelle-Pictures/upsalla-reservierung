// Konstanten der Online-Buchung — siehe docs/module/online-buchung.md, 5.7.
// Vorlauf/Vorausbuchung sind noch mit Upsalla zu bestätigen.

// Frühestens so viele Tage ab heute buchbar (heute + 2)
export const MIN_VORLAUF_TAGE = 2
// Spätestens so viele Tage im Voraus buchbar
export const MAX_VORAUS_TAGE = 180
// So lange blockiert eine unbezahlte Online-Buchung den Slot (5 Min. Puffer über Stripe)
export const HOLD_MINUTEN = 35
// Gültigkeit der Stripe-Checkout-Session (Stripe-Minimum: 30 Min.)
export const STRIPE_GUELTIGKEIT_SEKUNDEN = 1800
// Max. Buchungsversuche pro IP-Hash im Zeitfenster
export const RATE_LIMIT = { anzahl: 5, minuten: 10 } as const
// Alle Datumsangaben beziehen sich auf die Zeitzone des Parks
export const ZEITZONE = 'Europe/Berlin'
