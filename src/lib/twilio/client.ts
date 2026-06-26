export async function sendeSMS(an: string, nachricht: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const von = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !von) {
    console.warn('[Twilio] Zugangsdaten fehlen — SMS nicht gesendet')
    return
  }

  const credentials = Buffer.from(`${sid}:${token}`).toString('base64')

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: an, From: von, Body: nachricht }),
    },
  )

  if (!res.ok) {
    const fehler = await res.text()
    console.error('[Twilio] SMS-Fehler:', fehler)
  }
}
