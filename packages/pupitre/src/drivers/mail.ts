import type { MailAdapter, PupitreMailMessage } from '../adapters/mail.js'
import { E_PUPITRE_MISSING_PEER } from '../errors.js'

export type MailDriverOptions = { mailer?: string; from: string }

/** Adonis Mail adapter; the optional peer is loaded only when the adapter sends. */
export function mailDriver(options: MailDriverOptions): MailAdapter {
  return {
    async send(message: PupitreMailMessage) {
      // This optional peer is intentionally loaded on send, so apps without mail can use Pupitre.
      let mail
      try {
        const { default: service } = await import('@adonisjs/mail/services/main')
        mail = service
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND')
        )
          throw new E_PUPITRE_MISSING_PEER()
        throw error
      }
      const service = mail.use(options.mailer)
      await service.send((email) => {
        email
          .from(options.from)
          .to(message.to)
          .subject(message.subject)
          .html(message.html)
          .text(message.text)
      })
    },
  }
}
