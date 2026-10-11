import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  const schema = database.connection().schema
  await schema.createTableIfNotExists('relation_posts', (table) => {
    table.increments('id').notNullable()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('title').notNullable()
    table.timestamp('created_at').nullable()
    table.timestamp('updated_at').nullable()
  })
  await schema.createTableIfNotExists('relation_comments', (table) => {
    table.increments('id').notNullable()
    table
      .integer('post_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('relation_posts')
      .onDelete('CASCADE')
    table.integer('tenant_id').unsigned().nullable()
    table.string('title').notNullable()
    table.text('body').notNullable()
    table.timestamp('created_at').nullable()
    table.timestamp('updated_at').nullable()
  })
  await schema.createTableIfNotExists('relation_tags', (table) => {
    table.increments('id').notNullable()
    table.integer('tenant_id').unsigned().nullable()
    table.string('name').notNullable()
    table.timestamp('created_at').nullable()
    table.timestamp('updated_at').nullable()
  })
  await schema.createTableIfNotExists('relation_post_tags', (table) => {
    table
      .integer('post_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('relation_posts')
      .onDelete('CASCADE')
    table
      .integer('tag_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('relation_tags')
      .onDelete('CASCADE')
    table.string('note').nullable()
    table.primary(['post_id', 'tag_id'])
  })
  await schema.createTableIfNotExists('relation_revisions', (table) => {
    table.increments('id').notNullable()
    table
      .integer('post_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('relation_posts')
      .onDelete('CASCADE')
    table.string('title').notNullable()
    table.text('body').notNullable()
  })
}
