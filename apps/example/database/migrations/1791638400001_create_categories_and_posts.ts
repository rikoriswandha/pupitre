import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('categories', (table) => {
      table.increments('id').notNullable()
      table.string('name').notNullable()
      table.string('slug').notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    this.schema.createTable('posts', (table) => {
      table.increments('id').notNullable()
      table.string('title').notNullable()
      table.string('slug').notNullable().unique()
      table.enu('status', ['draft', 'published']).notNullable().defaultTo('draft')
      table.text('body').notNullable().defaultTo('')
      table.boolean('is_featured').notNullable().defaultTo(false)
      table.timestamp('published_at', { useTz: true }).nullable()
      table.integer('views_count').notNullable().defaultTo(0)
      table.integer('category_id').unsigned().notNullable().references('id').inTable('categories').onDelete('RESTRICT')
      table.integer('author_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.json('items').notNullable().defaultTo('[]')
      table.string('cover').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable('posts')
    this.schema.dropTable('categories')
  }
}
