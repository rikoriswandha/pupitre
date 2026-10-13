import { cp, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import nimbus, { defineConfig as defineNimbusConfig } from '@cloudflare/nimbus-docs'
import { tableScroll } from '@cloudflare/nimbus-docs/markdown'

const nimbusConfig = defineNimbusConfig({
  site: 'https://pupitre.rikology.com',
  title: 'Pupitre',
  description: 'Declarative admin panels for AdonisJS v7 and Inertia React.',
  locale: 'en',
  github: 'https://github.com/rikoriswandha/pupitre',
  editPattern: 'https://github.com/rikoriswandha/pupitre/edit/main/apps/docs/{path}',
  socialImageAlt: 'Pupitre documentation',
  sidebar: {
    items: [
      { label: 'Start here', items: ['getting-started', 'migrating-from-filament'] },
      { label: 'Build your panel', autogenerate: { directory: 'guides' } },
      { label: 'Extend Pupitre', items: ['customizing-ui', 'plugins'] },
      {
        label: 'Official plugins',
        items: [
          'plugins/shield',
          'plugins/audit',
          'plugins/settings',
          'plugins/transmit',
          'plugins/media',
          'plugins/calendar',
          'plugins/kanban',
          'plugins/health',
          'plugins/jobs',
          'plugins/backup',
        ],
      },
      { label: 'Reference', autogenerate: { directory: 'reference' } },
      'changelog',
    ],
  },
})

/**
 * Serve the shadcn registry (`/registry.json`, `/r/<name>.json`) from the
 * docs origin, so `pupitre:ui add` resolves against the deployed site.
 */
const registryOutput = {
  name: 'pupitre-registry-output',
  hooks: {
    'astro:build:done': async ({ dir }: { dir: URL }) => {
      const source = new URL('../../packages/pupitre-ui/registry/public/r/', import.meta.url)
      try {
        const info = await stat(source)
        if (!info.isDirectory()) throw new Error('Not a directory')
      } catch (cause) {
        throw new Error(
          'Pupitre docs build requires packages/pupitre-ui/registry/public/r/. Generate the UI registry before building the docs.',
          { cause }
        )
      }
      await cp(source, new URL('r/', dir), { recursive: true })
      await cp(
        new URL('../../packages/pupitre-ui/registry/public/registry.json', import.meta.url),
        new URL('registry.json', dir)
      )
      console.info(`Copied Pupitre registry to ${fileURLToPath(new URL('r/', dir))}`)
    },
  },
}

export default defineConfig({
  // nimbus:adapter
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    nimbus(nimbusConfig, {
      rules: {
        'nimbus/frontmatter-shape': 'error',
        'nimbus/internal-link': 'error',
      },
      markdown: {
        hastPlugins: [tableScroll()],
        features: { headingAttributes: true },
      },
    }),
    registryOutput,
  ],
})
