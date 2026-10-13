import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: 'sync',
  adapters: { sync: drivers.sync() },
  locations: ['./app/jobs/**/*.{ts,js}'],
})
