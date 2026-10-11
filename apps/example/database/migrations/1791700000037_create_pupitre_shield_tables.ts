import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('pupitre_roles', (table) => {
      table.increments('id')
      table.string('name', 160).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
    this.schema.createTable('pupitre_permissions', (table) => {
      table.increments('id')
      table.string('name', 254).notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
    this.schema.createTable('pupitre_permission_role', (table) => {
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('pupitre_roles')
        .onDelete('CASCADE')
      table
        .integer('permission_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('pupitre_permissions')
        .onDelete('CASCADE')
      table.primary(['role_id', 'permission_id'])
    })
    this.schema.createTable('pupitre_role_user', (table) => {
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('pupitre_roles')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.primary(['role_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable('pupitre_role_user')
    this.schema.dropTable('pupitre_permission_role')
    this.schema.dropTable('pupitre_permissions')
    this.schema.dropTable('pupitre_roles')
  }
}
