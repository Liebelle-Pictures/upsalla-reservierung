import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendeEmail(params: {
  an: string
  betreff: string
  html: string
}): Promise<void> {
  await resend.emails.send({
    from: 'Upsalla Kinderpark <no-reply@upsalla.de>',
    to: params.an,
    subject: params.betreff,
    html: params.html,
  })
}
