import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pupitre_job_runs'
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('id', 100).primary()
      table.string('job_id', 80).notNullable().index()
      table.string('name', 255).notNullable().index()
      table.string('queue', 255).notNullable()
      table.string('status', 20).notNullable().index()
      table.integer('attempt').notNullable()
      table.string('tenant_id', 255).nullable().index()
      table.text('payload_summary').notNullable()
      table.text('retry_payload').nullable()
      table.boolean('retry_safe').notNullable().defaultTo(false)
      table.text('error_message').nullable()
      table.text('error_stack').nullable()
      table.timestamp('queued_at', { useTz: true }).notNullable().index()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.double('duration_ms').nullable()
    })
  }
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
