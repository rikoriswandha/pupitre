import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('posts', (table) => {
      table
        .integer('cover_media_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('pupitre_media')
        .onDelete('SET NULL')
    })
  }
  async down() {
    this.schema.alterTable('posts', (table) => {
      table.dropColumn('cover_media_id')
    })
  }
}
