import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Store tables for the "Showcase" navigation group. JSON-shaped fields are text
 * columns serialized by the models so the example stays portable across dialects.
 */
export default class CreateShowcaseStoreTables extends BaseSchema {
  async up() {
    if (!(await this.schema.hasTable('products'))) {
      this.schema.createTable('products', (table) => {
        table.increments('id').notNullable()
        table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants')
        table.string('name').notNullable()
        table.string('slug').notNullable().unique()
        table.string('sku').notNullable()
        table.string('status').notNullable().defaultTo('draft')
        table.string('visibility').notNullable().defaultTo('public')
        table.integer('price').notNullable().defaultTo(0)
        table.integer('cost').nullable()
        table.integer('stock').notNullable().defaultTo(0)
        table.string('brand_color').nullable()
        table.text('sizes').nullable()
        table.text('labels').nullable()
        table.text('attributes').nullable()
        table.text('markets').nullable()
        table.text('channels').nullable()
        table.string('shipping_class').notNullable().defaultTo('standard')
        table.boolean('is_active').notNullable().defaultTo(true)
        table.date('available_from').nullable()
        table.string('restock_time').nullable()
        table.timestamp('launch_at', { useTz: true }).nullable()
        table.text('age_range').nullable()
        table.float('rating').notNullable().defaultTo(0)
        table.text('description').nullable()
        table.text('specs').nullable()
        table.text('gallery').nullable()
        table.string('spec_sheet').nullable()
        table.timestamp('created_at', { useTz: true }).notNullable()
        table.timestamp('updated_at', { useTz: true }).nullable()
      })
    }
    if (!(await this.schema.hasTable('product_variants'))) {
      this.schema.createTable('product_variants', (table) => {
        table.increments('id').notNullable()
        table
          .integer('product_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('products')
          .onDelete('CASCADE')
        table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants')
        table.string('name').notNullable()
        table.string('sku').notNullable()
        table.string('color').nullable()
        table.integer('stock').notNullable().defaultTo(0)
        table.integer('price').notNullable().defaultTo(0)
        table.timestamp('created_at', { useTz: true }).notNullable()
        table.timestamp('updated_at', { useTz: true }).nullable()
      })
    }
    if (!(await this.schema.hasTable('orders'))) {
      this.schema.createTable('orders', (table) => {
        table.increments('id').notNullable()
        table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants')
        table.string('number').notNullable().unique()
        table.string('customer_name').notNullable()
        table.string('customer_email').notNullable()
        table.string('customer_phone').nullable()
        table.string('status').notNullable().defaultTo('pending')
        table.string('payment_method').notNullable().defaultTo('card')
        table.text('items').nullable()
        table.integer('total').notNullable().defaultTo(0)
        table.text('shipping_address').nullable()
        table.text('notes').nullable()
        table.boolean('is_gift').notNullable().defaultTo(false)
        table.string('gift_message').nullable()
        table.string('source').nullable()
        table.timestamp('placed_at', { useTz: true }).nullable()
        table.timestamp('created_at', { useTz: true }).notNullable()
        table.timestamp('updated_at', { useTz: true }).nullable()
      })
    }
    if (!(await this.schema.hasTable('order_events'))) {
      this.schema.createTable('order_events', (table) => {
        table.increments('id').notNullable()
        table
          .integer('order_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('orders')
          .onDelete('CASCADE')
        table.integer('tenant_id').unsigned().notNullable().references('id').inTable('tenants')
        table.string('event').notNullable()
        table.text('note').nullable()
        table.string('actor').nullable()
        table.string('from_status').nullable()
        table.string('to_status').nullable()
        table.timestamp('created_at', { useTz: true }).notNullable()
        table.timestamp('updated_at', { useTz: true }).nullable()
      })
    }
  }

  async down() {
    for (const name of ['order_events', 'orders', 'product_variants', 'products']) {
      if (await this.schema.hasTable(name)) this.schema.dropTable(name)
    }
  }
}
