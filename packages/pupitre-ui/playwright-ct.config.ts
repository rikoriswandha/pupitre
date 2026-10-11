/* eslint-disable @unicorn/filename-case -- Playwright's config path is explicit in the test script. */
import { defineConfig } from '@playwright/experimental-ct-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  testDir: './tests/ct',
  testMatch: '**/*.spec.tsx',
  workers: 2,
  ...(process.env.CT_OUTPUT_DIR ? { outputDir: process.env.CT_OUTPUT_DIR } : {}),
  use: {
    // Overridable so concurrent CT runs (parallel agents, local + CI) do not collide.
    ctPort: Number(process.env.CT_PORT ?? 3100),
    ...(process.env.CT_CACHE_DIR ? { ctCacheDir: process.env.CT_CACHE_DIR } : {}),
    ctViteConfig: {
      plugins: [tailwindcss()],
      resolve: {
        conditions: ['@rikology/source', 'module', 'browser', 'development|production'],
        dedupe: ['react', 'react-dom'],
      },
    },
  },
})
