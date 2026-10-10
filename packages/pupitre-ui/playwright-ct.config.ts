import { defineConfig } from '@playwright/experimental-ct-react'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  testDir: './tests/ct',
  testMatch: '**/*.spec.tsx',
  workers: 2,
  use: {
    ctPort: 3100,
    ctViteConfig: {
      plugins: [react(), tailwind()],
    },
  },
})
