import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import adonisjs from '@adonisjs/vite/client'
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    adonisjs({ entryPoints: ['inertia/app.tsx'], reload: ['resources/views/**/*.edge'] }),
  ],

  /**
   * Define aliases for importing modules from
   * your frontend code
   */
  resolve: {
    alias: {
      '~/': `${import.meta.dirname}/inertia/`,
      '@generated': `${import.meta.dirname}/.adonisjs/client/`,
      // Tailwind resolves CSS @imports without custom conditions; point the skin at source
      // so token edits and new utility classes in pupitre-ui/src apply without a rebuild.
      '@rikology/pupitre-ui/styles.css': `${import.meta.dirname}/../../packages/pupitre-ui/src/styles.css`,
    },
    conditions: ['@rikology/source', 'module', 'browser', 'development|production'],
    dedupe: ['react', 'react-dom'],
  },

  server: {
    watch: {
      ignored: ['**/storage/**', '**/tmp/**'],
    },
    // Lets several dev servers run side by side (one HMR socket each).
    ...(process.env.VITE_HMR_PORT ? { hmr: { port: Number(process.env.VITE_HMR_PORT) } } : {}),
  },
})
