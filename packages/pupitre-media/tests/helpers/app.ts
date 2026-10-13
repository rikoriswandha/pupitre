import { definePanel } from '@rikology/pupitre'
import { createTestApp, closeTestApp } from '../../../pupitre/tests/helpers/app.js'
import { media } from '../../index.js'
import type { MediaOptions } from '../../index.js'
import Migration from '../fixtures/migration.js'
export async function mediaApp(options: MediaOptions = { authorize: () => true }) {
  const fixture = await createTestApp({
    panels: {
      admin: async () => ({
        default: (options.tenancy
          ? definePanel('admin').tenancy({
              mode: 'implicit',
              adapter: {
                async resolve() {
                  return { id: 1, name: 'Own tenant' }
                },
                scope(query, tenant, scopeOptions) {
                  query.where(scopeOptions.ownership, String(tenant.id))
                },
                fill(data) {
                  return data
                },
                async listForUser() {
                  return [{ id: 1, name: 'Own tenant' }]
                },
              },
            })
          : definePanel('admin')
        ).plugins([media({ disk: 'uploads', ...options })]),
      }),
    },
    setup: async (_router, app) => {
      const database = await app.container.make('lucid.db')
      if (!(await database.connection().schema.hasTable('pupitre_media')))
        await new Migration(database.connection(), 'media').execUp()
      await database.from('pupitre_media').delete()
    },
  })
  return { ...fixture, close: () => closeTestApp(fixture) }
}
