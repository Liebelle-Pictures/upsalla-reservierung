import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
)

export async function sendeSMS(an: string, nachricht: string): Promise<void> {
  await client.messages.create({
    body: nachricht,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: an,
  })
}
