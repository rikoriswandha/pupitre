/* eslint-disable @unicorn/filename-case -- Playwright's config path is explicit in the test script. */
import { defineConfig } from '@playwright/experimental-ct-react'

export default defineConfig({
  testDir: './tests/ct',
  testMatch: '**/*.spec.tsx',
  workers: 2,
  use: {
    ctPort: 3100,
    ctViteConfig: {
      resolve: {
        conditions: ['@rikology/source', 'module', 'browser', 'development|production'],
        dedupe: ['react', 'react-dom'],
      },
    },
  },
})
