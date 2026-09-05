import { Resend } from 'resend'

export async function sendeEmail(params: {
  an: string
  betreff: string
  html: string
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const absender = process.env.RESEND_FROM_EMAIL ?? 'Upsalla Kinderpark <noreply@upsalla-kinderpark.de>'
  await resend.emails.send({
    from: absender,
    to: params.an,
    subject: params.betreff,
    html: params.html,
  })
}
