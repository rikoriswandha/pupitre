import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddSocialIdentityToUsers extends BaseSchema {
  protected tableName = 'users'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    const missing: string[] = []
    for (const column of ['provider', 'provider_id']) {
      if (!(await this.schema.hasColumn(this.tableName, column))) missing.push(column)
    }
    if (!missing.length) return
    this.schema.alterTable(this.tableName, (table) => {
      for (const column of missing) table.string(column).nullable()
    })
  }

  async down() {
    if (!(await this.schema.hasTable(this.tableName))) return
    const present: string[] = []
    for (const column of ['provider_id', 'provider']) {
      if (await this.schema.hasColumn(this.tableName, column)) present.push(column)
    }
    if (!present.length) return
    this.schema.alterTable(this.tableName, (table) => table.dropColumns(...present))
  }
}
