import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('pupitre_backups', (table) => {
      table.uuid('id').primary()
      table.string('disk').notNullable()
      table.string('path', 1024).notNullable()
      table.bigInteger('size').notNullable().defaultTo(0)
      table.string('status').notNullable()
      table.text('error').nullable()
      table.string('connection').notNullable()
      table.string('dialect').notNullable()
      table.string('created_by').nullable()
      table.string('tenant_id').nullable().index()
      table.string('active_lock').nullable().unique()
      table.timestamp('started_at', { useTz: true }).notNullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
    })
  }
  async down() {
    this.schema.dropTable('pupitre_backups')
  }
}
