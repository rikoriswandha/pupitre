import { defineConfig } from '@rikology/pupitre'

export default defineConfig({
  path: '/admin',
  cache: { dev: false },
  timezone: 'UTC',
  storage: { disk: 'uploads' },
})