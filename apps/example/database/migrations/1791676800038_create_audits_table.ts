import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('stream', 64).notNullable()
      table.bigInteger('seq').notNullable()
      table.string('hash', 64).notNullable()
      table.string('prev_hash', 64).notNullable()

      table.string('event', 128).notNullable()
      table.string('auditable_type', 128).nullable()
      table.string('auditable_id', 64).nullable()
      table.jsonb('old_values').nullable()
      table.jsonb('new_values').nullable()
      table.jsonb('metadata').nullable()

      table.string('actor_type', 64).nullable()
      table.string('actor_id', 64).nullable()
      table.string('actor_label', 255).nullable()

      table.string('tenant_id', 64).nullable()
      table.string('request_id', 64).nullable()
      table.string('correlation_id', 64).nullable()
      table.string('ip_address', 45).nullable()
      table.string('user_agent', 512).nullable()
      table.string('url', 2048).nullable()
      table.string('http_method', 10).nullable()
      table.jsonb('tags').notNullable()

      table.string('schema_version', 8).notNullable().defaultTo('1')
      table.timestamp('created_at', { useTz: true, precision: 3 }).notNullable()

      table.unique(['stream', 'seq'])
      table.index(['auditable_type', 'auditable_id', 'seq'])
      table.index(['actor_type', 'actor_id', 'seq'])
      table.index(['event', 'created_at'])
      table.index(['stream', 'seq'])
      table.index(['tenant_id'])
    })

    this.schema.createTable('audit_archive_events', (table) => {
      table.uuid('id').primary()
      table.string('stream', 64).notNullable()
      table.bigInteger('seq').notNullable()
      table.string('hash', 64).notNullable()
      table.string('prev_hash', 64).notNullable()
      table.timestamp('created_at', { useTz: true, precision: 3 }).notNullable()

      table.unique(['stream', 'seq'])
      table.index(['stream', 'seq'])
    })

    this.schema.createTable('audit_chain_checkpoints', (table) => {
      table.string('stream', 64).notNullable()
      table.bigInteger('seq').notNullable()
      table.string('hash', 64).notNullable()
      table.timestamp('created_at', { useTz: true, precision: 3 }).notNullable()

      table.unique(['stream', 'seq'])
      table.index(['stream', 'seq'])
    })

    if (
      this.db.dialect.name === 'sqlite3' ||
      this.db.dialect.name === 'better-sqlite3' ||
      this.db.dialect.name === 'libsql'
    ) {
      this.schema.createTable('audit_maintenance_guard', (table) => {
        table.string('operation', 32).primary()
      })
    }
  }

  async down() {
    this.schema.dropTable('audit_chain_checkpoints')
    this.schema.dropTable('audit_archive_events')
    this.schema.dropTable(this.tableName)

    if (
      this.db.dialect.name === 'sqlite3' ||
      this.db.dialect.name === 'better-sqlite3' ||
      this.db.dialect.name === 'libsql'
    ) {
      this.schema.dropTable('audit_maintenance_guard')
    }
  }
}
