import type { Database } from '@adonisjs/lucid/database'

export async function up(database: Database) {
  // Knex schema builders retain queued statements: use a fresh builder per operation.
  if (!(await database.connection().schema.hasTable('relation_posts')))
    await database.connection().schema.createTable('relation_posts', (table) => {
      table.increments('id').notNullable()
      table.integer('tenant_id').unsigned().notNullable()
      table.string('title').notNullable()
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()
    })
  if (!(await database.connection().schema.hasTable('relation_comments')))
    await database.connection().schema.createTable('relation_comments', (table) => {
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
  if (!(await database.connection().schema.hasTable('relation_tags')))
    await database.connection().schema.createTable('relation_tags', (table) => {
      table.increments('id').notNullable()
      table.integer('tenant_id').unsigned().nullable()
      table.string('name').notNullable()
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()
    })
  if (!(await database.connection().schema.hasTable('relation_post_tags')))
    await database.connection().schema.createTable('relation_post_tags', (table) => {
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
  if (!(await database.connection().schema.hasTable('relation_revisions')))
    await database.connection().schema.createTable('relation_revisions', (table) => {
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
