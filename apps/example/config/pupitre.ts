import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { defineConfig } from '@rikology/pupitre'
import { transmitRealtime } from '@rikology/pupitre-transmit'
import { auditAdapter } from '@rikology/pupitre/drivers/audit'

export default defineConfig({
  cache: { dev: false },
  timezone: 'UTC',
  storage: { disk: 'uploads' },
  auth: { model: () => import('#models/user') },
  realtime: transmitRealtime(),
  audit: auditAdapter(),
  mail: async () => ({
    async send(message) {
      const directory = process.env.PUPITRE_MAIL_DIR ?? app.makePath('tmp/mails')
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, `${randomUUID()}.json`), JSON.stringify(message, null, 2))
    },
  }),
  notifications: async () => {
    const { notificationsAdapter } = await import('@rikology/pupitre/drivers/notifications')
    return notificationsAdapter()
  },
})
