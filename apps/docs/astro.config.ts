import { cp, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import nimbus, { defineConfig as defineNimbusConfig } from '@cloudflare/nimbus-docs'
import { tableScroll } from '@cloudflare/nimbus-docs/markdown'

const nimbusConfig = defineNimbusConfig({
  site: 'https://pupitre.rikology.com',
  title: 'Pupitre',
  description:
    'Filament-class admin panels for AdonisJS v7 and Inertia React: typed resources, reactive forms, tables and server-authorized actions.',
  locale: 'en',
  github: 'https://github.com/rikoriswandha/pupitre',
  editPattern: 'https://github.com/rikoriswandha/pupitre/edit/main/apps/docs/{path}',
  socialImageAlt: 'Pupitre: declarative admin panels for AdonisJS v7 and Inertia React',
  head: [
    { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' } },
    { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
    { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
    { tag: 'meta', attrs: { name: 'theme-color', content: '#f9f7f2', media: '(prefers-color-scheme: light)' } },
    { tag: 'meta', attrs: { name: 'theme-color', content: '#110f0e', media: '(prefers-color-scheme: dark)' } },
    { tag: 'meta', attrs: { name: 'author', content: 'Riko Riswandha' } },
  ],
  sidebar: {
    items: [
      { label: 'Start here', items: ['introduction', 'getting-started', 'migrating-from-filament'] },
      { label: 'Core concepts', items: ['guides/panels', 'guides/navigation-clusters', 'guides/resources'] },
      {
        label: 'Forms, tables and records',
        items: [
          'guides/forms',
          'guides/infolists',
          'guides/tables',
          'guides/saved-views',
          'guides/actions',
          'guides/notifications',
        ],
      },
      { label: 'Pages and dashboards', items: ['guides/widgets', 'guides/custom-pages'] },
      {
        label: 'Users and access',
        items: ['guides/auth', 'guides/authorization', 'guides/tenancy', 'guides/impersonation'],
      },
      { label: 'Look and locale', items: ['guides/theming', 'guides/localization', 'guides/timezones'] },
      { label: 'Extend Pupitre', items: ['customizing-ui', 'guides/custom-components', 'plugins'] },
      { label: 'Integrate and test', items: ['guides/adapters', 'guides/testing'] },
      {
        label: 'Official plugins',
        items: [
          'plugins/overview',
          'plugins/shield',
          'plugins/audit',
          'plugins/settings',
          'plugins/media',
          'plugins/transmit',
          'plugins/calendar',
          'plugins/kanban',
          'plugins/jobs',
          'plugins/health',
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
