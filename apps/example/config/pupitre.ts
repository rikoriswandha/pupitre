import { defineConfig } from '@rikology/pupitre'

export default defineConfig({
  cache: { dev: false },
  timezone: 'UTC',
  storage: { disk: 'uploads' },
})
