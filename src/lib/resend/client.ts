import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY!)

// RESEND_FROM_EMAIL setzen sobald Domain verifiziert ist, z.B.:
// "Upsalla Kinderpark <buchung@upsalla-kinderpark.de>"
// Bis dahin: Resend Testabsender (funktioniert ohne eigene Domain)
const ABSENDER = process.env.RESEND_FROM_EMAIL ?? 'Upsalla Kinderpark <onboarding@resend.dev>'

export async function sendeEmail(params: {
  an: string
  betreff: string
  html: string
}): Promise<void> {
  await resend.emails.send({
    from: ABSENDER,
    to: params.an,
    subject: params.betreff,
    html: params.html,
  })
}
