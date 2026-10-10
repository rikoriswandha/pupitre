import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'tmp/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3391',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'node e2e/setup-db.mjs && node ace serve --hmr',
    cwd: import.meta.dirname,
    timeout: 120_000,
    url: 'http://localhost:3391/login',
    env: {
      NODE_OPTIONS: '--conditions=@rikology/source',
      PORT: '3391',
      DB_DATABASE: 'tmp/pupitre-e2e.sqlite',
      NODE_ENV: 'development',
    },
  },
})
