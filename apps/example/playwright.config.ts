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
    command:
      'npm --prefix ../.. run build && NODE_ENV=development node e2e/setup-db.mjs && node ace build --ignore-ts-errors && cd build && NODE_OPTIONS= node bin/server.js',
    cwd: import.meta.dirname,
    reuseExistingServer: !process.env.CI,
    url: 'http://localhost:3391/login',
    env: {
      NODE_OPTIONS: '--conditions=@rikology/source',
      PORT: '3391',
      HOST: 'localhost',
      LOG_LEVEL: 'error',
      APP_KEY: 'pupitre-e2e-key-that-is-long-enough-for-tests',
      PUPITRE_MAIL_DIR: `${import.meta.dirname}/tmp/mails`,
      APP_URL: 'http://localhost:3391',
      SESSION_DRIVER: 'cookie',
      DB_DATABASE: `${import.meta.dirname}/tmp/pupitre-e2e.sqlite`,
      TZ: 'UTC',
      NODE_ENV: 'production',
    },
  },
})
