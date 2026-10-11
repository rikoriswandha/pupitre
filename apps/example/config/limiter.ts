import { defineConfig, stores } from '@adonisjs/limiter'

export default defineConfig({
  default: 'memory',
  stores: {
    memory: stores.memory({}),
  },
})
