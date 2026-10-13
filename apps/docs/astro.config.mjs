import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { cp, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  site: 'https://pupitre.dev',
  output: 'static',
  outDir: './dist',
  integrations: [
    starlight({
      title: 'Pupitre',
      description: 'Declarative admin panels for AdonisJS v7 and Inertia React.',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/rikoriswandha/pupitre' }],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Start here', items: ['getting-started', 'migrating-from-filament'] },
        { label: 'Build your panel', items: [{ autogenerate: { directory: 'guides' } }] },
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
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
        { label: 'Changelog', slug: 'changelog' },
      ],
    }),
    {
      name: 'pupitre-registry-output',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const source = new URL('../../packages/pupitre-ui/registry/public/r/', import.meta.url)
          try {
            if (!(await stat(source)).isDirectory()) throw new Error('Not a directory')
          } catch (cause) {
            throw new Error('Pupitre docs build requires packages/pupitre-ui/registry/public/r/. Generate the UI registry before building the docs.', { cause })
          }
          await cp(source, new URL('r/', dir), { recursive: true })
          await cp(
            new URL('../../packages/pupitre-ui/registry/public/registry.json', import.meta.url),
            new URL('registry.json', dir)
          )
          console.info(`Copied Pupitre registry to ${fileURLToPath(new URL('r/', dir))}`)
        },
      },
    },
  ],
})
