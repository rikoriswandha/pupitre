/** Outgoing email produced by Pupitre (password reset, verification). */
export type PupitreMailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Mail adapter (DESIGN §Adapters). Official driver over `@adonisjs/mail`:
 * `@rikology/pupitre/drivers/mail`.
 */
export interface MailAdapter {
  send(message: PupitreMailMessage): Promise<void>
}
