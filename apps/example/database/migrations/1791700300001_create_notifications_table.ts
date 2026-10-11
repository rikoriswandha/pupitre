import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    if (await this.schema.hasTable(this.tableName)) return
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('type').notNullable()
      table.string('notifiable_type').notNullable()
      table.string('notifiable_id').notNullable()
      table.json('data').notNullable()
      table.json('metadata').nullable()
      table.timestamp('read_at', { useTz: true }).nullable()
      table.timestamp('seen_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.index(['notifiable_type', 'notifiable_id', 'read_at'])
      table.index(['notifiable_type', 'notifiable_id', 'created_at'])
      table.index('type')
    })
  }

  async down() {
    if (await this.schema.hasTable(this.tableName)) this.schema.dropTable(this.tableName)
  }
}
