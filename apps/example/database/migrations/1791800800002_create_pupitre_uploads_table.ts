import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pupitre_uploads'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) {
      this.schema.createTable(this.tableName, (table) => {
        table.string('key', 1024).primary()
        table.string('disk').nullable()
        table.string('owner').notNullable()
        table.string('panel').notNullable()
        table.string('resource').notNullable()
        table.string('field').notNullable()
        table.bigInteger('created_at').notNullable()
        table.bigInteger('consumed_at').nullable()
        table.index(['consumed_at', 'created_at'], 'pupitre_uploads_cleanup_index')
      })
    }
  }

  async down() {
    if (await this.schema.hasTable(this.tableName)) this.schema.dropTable(this.tableName)
  }
}
