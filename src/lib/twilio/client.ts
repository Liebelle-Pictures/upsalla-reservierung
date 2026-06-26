// Twilio-Integration — noch nicht aktiv (folgt nach Go-Live)
export async function sendeSMS(_an: string, _nachricht: string): Promise<void> {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    console.log('[Twilio] SMS an', _an, ':', _nachricht)
  }
}
