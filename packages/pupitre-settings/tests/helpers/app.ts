import { definePanel } from '@rikology/pupitre'
import { closeTestApp, createTestApp } from '../../../pupitre/tests/helpers/app.js'
import { settings } from '../../index.js'
import type { SettingsOptions } from '../../index.js'
import Migration from '../fixtures/migration.js'

export async function settingsApp(options: SettingsOptions) {
  const fixture = await createTestApp({
    panels: { admin: async () => ({ default: definePanel('admin').plugins([settings(options)]) }) },
    setup: async (_router, app) => {
      const database = await app.container.make('lucid.db')
      await new Migration(database.connection(), 'settings').execUp()
      await database.from('pupitre_settings').delete()
    },
  })
  return { ...fixture, close: () => closeTestApp(fixture) }
}
