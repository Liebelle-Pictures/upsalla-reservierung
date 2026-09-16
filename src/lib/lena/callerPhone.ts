// Fallback-Ermittlung der echten Anrufer-Nummer direkt aus dem Tool-Call-Webhook-Payload
// (raw.call, gleiche Form wie die Retell get-call API), NICHT über {{caller_phone}} im Prompt.
// Grund: reale Testanrufe zeigten wiederholt, dass das LLM {{caller_phone}} beim Aufruf von
// create_reservation/notiz_fuers_team ignoriert und stattdessen einen Platzhalter wie "+49"
// erfindet, obwohl die echte Nummer im System-Prompt-Kontext verfügbar war — ein Modell-
// Zuverlässigkeitsproblem, kein Datenproblem. Dieser serverseitige Fallback macht die
// Anrufer-Nummer unabhängig vom Verhalten des LLM zuverlässig nutzbar.
export function extrahiereAnruferNummer(raw: Record<string, unknown>): string | null {
  const call = raw.call as Record<string, unknown> | undefined
  if (!call) return null

  const sipHeaders = (call.custom_sip_headers as Record<string, string> | undefined) ?? {}
  const paiKey = Object.keys(sipHeaders).find(k => k.toLowerCase() === 'p-asserted-identity')
  const paiValue = paiKey ? sipHeaders[paiKey] : undefined
  const paiMatch = paiValue?.match(/\+\d{6,15}/)

  return paiMatch?.[0] ?? (call.from_number as string | undefined) ?? null
}

// Lokales Format (0...) statt international (+49...) — konsistent mit dem Format, das Kunden
// nennen/bestätigen und das an anderer Stelle (retell-inbound) auch schon verwendet wird.
export function zuLokalesFormat(nummer: string): string {
  return nummer.startsWith('+49') ? `0${nummer.slice(3)}` : nummer
}
