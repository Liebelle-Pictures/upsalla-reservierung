import { Resend } from 'resend'

export async function sendeEmail(params: {
  an: string
  betreff: string
  html: string
  kalenderAnhang?: { dateiname: string; inhalt: string; methode: 'REQUEST' | 'CANCEL' }
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const absender = process.env.RESEND_FROM_EMAIL ?? 'Upsalla Kinderpark <noreply@upsalla-kinderpark.de>'
  await resend.emails.send({
    from: absender,
    to: params.an,
    subject: params.betreff,
    html: params.html,
    attachments: params.kalenderAnhang
      ? [{
          filename: params.kalenderAnhang.dateiname,
          content: params.kalenderAnhang.inhalt,
          contentType: `text/calendar; charset=utf-8; method=${params.kalenderAnhang.methode}`,
        }]
      : undefined,
  })
}
