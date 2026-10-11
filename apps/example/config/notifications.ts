import { channels, defineConfig } from '@rikology/adonisjs-notifications'

export default defineConfig({
  channels: { database: channels.database() },
  database: {
    table: 'notifications',
    deliveriesTable: 'notification_deliveries',
    idStrategy: 'uuid',
  },
  delivery: { recordAttempts: false, failFast: true, retry: { attempts: 1, backoff: [] } },
})
