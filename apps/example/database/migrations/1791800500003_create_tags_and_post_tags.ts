import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateTagsAndPostTags extends BaseSchema {
  async up() {
    if (!(await this.schema.hasTable('tags'))) {
      this.schema.createTable('tags', (table) => {
        table.increments('id').notNullable()
        table.string('name').notNullable()
        table.string('slug').notNullable().unique()
        table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants')
        table.timestamp('created_at', { useTz: true }).notNullable()
        table.timestamp('updated_at', { useTz: true }).notNullable()
      })
    }
    if (!(await this.schema.hasTable('post_tags'))) {
      this.schema.createTable('post_tags', (table) => {
        table
          .integer('post_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('posts')
          .onDelete('CASCADE')
        table
          .integer('tag_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('tags')
          .onDelete('CASCADE')
        table.string('note').nullable()
        table.primary(['post_id', 'tag_id'])
      })
    }
  }

  async down() {
    if (await this.schema.hasTable('post_tags')) this.schema.dropTable('post_tags')
    if (await this.schema.hasTable('tags')) this.schema.dropTable('tags')
  }
}
