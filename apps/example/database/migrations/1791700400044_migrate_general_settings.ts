import { BaseSchema } from '@adonisjs/lucid/schema'

/** The playground still owns the legacy table; move only the general settings keys. */
export default class extends BaseSchema {
  async up() {
    this.defer(async (database) => {
      const keys = ['siteName', 'maintenanceMode', 'defaultTheme', 'editorConfig']
      const rows = await database.from('settings').whereIn('key', keys)
      for (const row of rows) {
        const existing = await database
          .from('pupitre_settings')
          .where({ group: 'general', scope_key: 'global', key: row.key })
          .first()
        if (existing) continue
        await database.table('pupitre_settings').insert({
          group: 'general',
          scope_key: 'global',
          key: row.key,
          value: JSON.stringify({
            value: row.key === 'maintenanceMode' ? row.value === 'true' : row.value,
          }),
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
      }
    })
  }
  async down() {
    // Keep preserved data: table ownership belongs to the plugin's earlier migration.
  }
}
