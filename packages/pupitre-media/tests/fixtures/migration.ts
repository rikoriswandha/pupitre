import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  protected tableName = 'pupitre_media'
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('disk').notNullable()
      table.string('directory').notNullable()
      table.string('path', 1024).notNullable().unique()
      table.string('visibility').notNullable().defaultTo('private')
      table.string('filename').notNullable()
      table.string('mime').notNullable().index()
      table.bigInteger('size').notNullable()
      table.integer('width').nullable()
      table.integer('height').nullable()
      table.string('alt').nullable()
      table.string('title').nullable()
      table.text('caption').nullable()
      table.json('conversions').notNullable()
      table.string('tenant_id').nullable().index()
      table.string('uploaded_by').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
