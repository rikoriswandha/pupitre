import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    if (await this.schema.hasTable('pupitre_settings')) return
    this.schema.createTable('pupitre_settings', (table) => {
      table.increments('id')
      table.string('group', 120).notNullable()
      table.string('scope_key', 254).notNullable()
      table.string('key', 120).notNullable()
      table.json('value').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['group', 'scope_key', 'key'], { indexName: 'pupitre_settings_identity_unique' })
      // Test-only fault: force a failure on the second key in an otherwise valid patch.
      table.check(
        "key <> 'count' OR CAST(value AS TEXT) <> '{\"value\":99}'",
        [],
        'settings_test_count_check'
      )
    })
  }

  async down() {
    if (await this.schema.hasTable('pupitre_settings')) this.schema.dropTable('pupitre_settings')
  }
}
