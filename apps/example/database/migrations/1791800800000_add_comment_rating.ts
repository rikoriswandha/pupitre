import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddCommentRating extends BaseSchema {
  protected tableName = 'comments'

  async up() {
    if (!(await this.schema.hasTable(this.tableName))) return
    if (!(await this.schema.hasColumn(this.tableName, 'rating'))) {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('rating').notNullable().defaultTo(0)
      })
    }
    if (!(await this.schema.hasColumn(this.tableName, 'rating_details'))) {
      this.schema.alterTable(this.tableName, (table) => {
        table.json('rating_details').notNullable().defaultTo('[]')
      })
    }
  }

  async down() {
    if (!(await this.schema.hasTable(this.tableName))) return
    for (const name of ['rating_details', 'rating']) {
      if (await this.schema.hasColumn(this.tableName, name)) {
        this.schema.alterTable(this.tableName, (table) => table.dropColumn(name))
      }
    }
  }
}
