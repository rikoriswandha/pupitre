import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Post from '#models/post'
import Comment from '#models/comment'
import Tenant from '#models/tenant'
import Tag from '#models/tag'
import User from '#models/user'
import Product from '#models/product'
import ProductVariant from '#models/product_variant'
import Order from '#models/order'
import type { OrderItem, OrderStatus } from '#models/order'
import OrderEvent from '#models/order_event'
import { Role, Permission } from '@rikology/pupitre-shield'

const PRODUCT_NAMES = [
  'Field Notes Notebook',
  'Fountain Pen',
  'Midnight Ink Bottle',
  'Canvas Tote',
  'Desk Lamp',
  'Archive Box',
  'Linen Bookmark Set',
  'Brass Ruler',
  'Letterpress Cards',
  'Wool Desk Mat',
  'Travel Journal',
  'Pencil Case',
]
const PRODUCT_STOCK = [120, 8, 45, 0, 64, 3, 210, 18, 75, 5, 32, 90]
const PRODUCT_COLORS = ['#1f3a5f', '#8a5a44', '#0f172a', '#c2a878', '#d97706', '#475569']
const CUSTOMERS = [
  ['Sari Wulandari', 'sari@example.net', 'Bandung'],
  ['Lukas de Vries', 'lukas@example.net', 'Utrecht'],
  ['Mei Tan', 'mei@example.net', 'Singapore'],
  ['Arif Rahman', 'arif@example.net', 'Jakarta'],
  ['Noor Aziz', 'noor@example.net', 'Kuala Lumpur'],
  ['Emma Laurent', 'emma@example.net', 'Lyon'],
] as const
const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'delivered',
  'refunded',
  'cancelled',
  'paid',
]
/** Status path each seeded order walks through, so the history timeline is realistic. */
const STATUS_PATHS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['pending'],
  paid: ['pending', 'paid'],
  shipped: ['pending', 'paid', 'shipped'],
  delivered: ['pending', 'paid', 'shipped', 'delivered'],
  refunded: ['pending', 'paid', 'refunded'],
  cancelled: ['pending', 'cancelled'],
}

export default class MainSeeder extends BaseSeeder {
  async run() {
    const admin = await User.updateOrCreate(
      { email: 'admin@example.com' },
      {
        fullName: 'Editorial Admin',
        password: 'password',
        timezone: 'Asia/Jakarta',
        emailVerifiedAt: DateTime.now(),
      }
    )
    const editor = await User.updateOrCreate(
      { email: 'editor@example.com' },
      {
        fullName: 'Editorial Editor',
        password: 'password',
        timezone: 'Europe/Amsterdam',
        emailVerifiedAt: DateTime.now(),
      }
    )
    const superAdmin = await Role.firstOrCreate({ name: 'super-admin' })
    const editorRole = await Role.firstOrCreate({ name: 'editor' })
    const editorPermissions = await Permission.fetchOrCreateMany('name', [
      { name: 'posts.viewAny' },
      { name: 'posts.view' },
      { name: 'posts.update' },
    ])
    await editorRole
      .related('permissions')
      .sync(editorPermissions.map((permission) => permission.id))
    await admin.related('roles').sync([superAdmin.id])
    await editor.related('roles').sync([editorRole.id])
    // Dedicated account for the password-reset e2e flow so it can't affect other logins.
    const resetUser = await User.updateOrCreate(
      { email: 'reset@example.com' },
      {
        fullName: 'Password Reset Demo',
        password: 'password',
        timezone: null,
        emailVerifiedAt: DateTime.now(),
      }
    )
    const mfaUser = await User.updateOrCreate(
      { email: 'mfa@example.com' },
      {
        fullName: 'MFA Passkeys Demo',
        password: 'password',
        timezone: null,
        emailVerifiedAt: DateTime.now(),
      }
    )
    const [acme, globex] = await Promise.all([
      Tenant.updateOrCreate({ slug: 'acme' }, { name: 'Acme', slug: 'acme' }),
      Tenant.updateOrCreate({ slug: 'globex' }, { name: 'Globex', slug: 'globex' }),
    ])

    await db.from('tenant_user').delete()
    await db.table('tenant_user').insert([
      {
        tenant_id: acme.id,
        user_id: admin.id,
        created_at: DateTime.now().toSQL(),
        updated_at: null,
      },
      {
        tenant_id: globex.id,
        user_id: admin.id,
        created_at: DateTime.now().toSQL(),
        updated_at: null,
      },
      {
        tenant_id: acme.id,
        user_id: editor.id,
        created_at: DateTime.now().toSQL(),
        updated_at: null,
      },
      {
        tenant_id: acme.id,
        user_id: resetUser.id,
        created_at: DateTime.now().toSQL(),
        updated_at: null,
      },
      {
        tenant_id: acme.id,
        user_id: mfaUser.id,
        created_at: DateTime.now().toSQL(),
        updated_at: null,
      },
    ])

    const seedDate = DateTime.fromISO('2026-10-10T12:00:00.000Z', { zone: 'utc' })
    for (const tenant of [acme, globex]) {
      const prefix = tenant.slug === 'acme' ? '' : 'globex-'
      const categories = await Promise.all(
        ['culture', 'design', 'technology'].map((category) =>
          Category.updateOrCreate(
            { slug: `${prefix}${category}` },
            {
              name: category[0]!.toUpperCase() + category.slice(1),
              slug: `${prefix}${category}`,
              tenantId: tenant.id,
            }
          )
        )
      )
      const tags = await Promise.all(
        ['research', 'editorial', 'community'].map((name) =>
          Tag.updateOrCreate(
            { slug: `${prefix}${name}` },
            {
              name: name[0]!.toUpperCase() + name.slice(1),
              slug: `${prefix}${name}`,
              tenantId: tenant.id,
            }
          )
        )
      )
      for (let index = 1; index <= 30; index++) {
        const published = index % 3 !== 0
        const publishedAt = published ? seedDate.minus({ days: index * 3 }) : null
        const number = index.toString().padStart(2, '0')
        const post = await Post.updateOrCreate(
          { slug: `${prefix}field-notes-${number}` },
          {
            title: `${tenant.slug === 'acme' ? '' : 'Globex '}Field Notes ${number}`,
            slug: `${prefix}field-notes-${number}`,
            status: published ? 'published' : 'draft',
            body: `<p>Editorial note ${index} from the ${tenant.name} dogfood journal.</p>`,
            summary: `## Field Notes ${number}\n\nEditorial note ${index} from the ${tenant.name} dogfood journal.`,
            isFeatured: index % 5 === 0,
            publishedAt,
            viewsCount: index * 17,
            categoryId: categories[(index - 1) % categories.length]!.id,
            authorId: admin.id,
            tenantId: tenant.id,
            items: [
              { sku: `NOTE-${index}`, qty: (index % 4) + 1, price: index * 1250 },
              { sku: `INK-${index}`, qty: 2, price: 8500 },
            ],
          }
        )
        await Comment.updateOrCreate(
          { postId: post.id, title: `Reader note ${number}` },
          {
            postId: post.id,
            title: `Reader note ${number}`,
            body: `A seeded comment for ${post.title}.`,
            tenantId: tenant.id,
          }
        )
        const tag = tags[(index - 1) % tags.length]!
        await post.related('tags').detach()
        await post.related('tags').attach({
          [String(tag.id)]: { note: `Seeded relationship note ${number}` },
        })
      }
      await this.seedStore(tenant, prefix, seedDate)
    }
  }

  /** Products, variants, orders and order history for the Showcase navigation group. */
  private async seedStore(tenant: Tenant, prefix: string, seedDate: DateTime) {
    const skuPrefix = prefix ? 'GX' : 'AC'
    const products: Product[] = []
    for (const [index, name] of PRODUCT_NAMES.entries()) {
      const status = index % 5 === 4 ? 'archived' : index % 4 === 3 ? 'draft' : 'active'
      const price = 45_000 + index * 17_500
      const slug = `${prefix}${name.toLowerCase().replaceAll(' ', '-')}`
      const product = await Product.updateOrCreate(
        { slug },
        {
          tenantId: tenant.id,
          name: prefix ? `Globex ${name}` : name,
          slug,
          sku: `${skuPrefix}-${String(index + 1).padStart(3, '0')}`,
          status,
          visibility: (['public', 'public', 'unlisted', 'private'] as const)[index % 4]!,
          price,
          cost: Math.round(price * 0.55),
          stock: PRODUCT_STOCK[index]!,
          brandColor: PRODUCT_COLORS[index % PRODUCT_COLORS.length]!,
          sizes: [['S', 'M', 'L'], ['M'], ['S', 'M', 'L', 'XL'], []][index % 4]!,
          labels: [['bestseller'], ['new', 'limited'], ['gift'], []][index % 4]!,
          attributes: {
            material: ['Recycled paper', 'Brass', 'Glass', 'Canvas'][index % 4]!,
            origin: ['Bandung', 'Utrecht', 'Kyoto'][index % 3]!,
          },
          markets: [['id', 'sg'], ['id'], ['id', 'sg', 'my', 'nl']][index % 3]!,
          channels: [['web'], ['web', 'retail'], ['web', 'retail', 'wholesale']][index % 3]!,
          shippingClass: (['standard', 'express', 'freight'] as const)[index % 3]!,
          isActive: status === 'active',
          availableFrom: seedDate.minus({ days: index * 7 }).startOf('day'),
          restockTime: ['09:00', '13:30', '16:00'][index % 3]!,
          launchAt: seedDate.minus({ days: index * 7 }),
          ageRange: [12 + (index % 3) * 4, 80],
          rating: 3.5 + (index % 4) * 0.5,
          description: `## ${name}\n\nMade for long writing sessions. Ships in recycled packaging.`,
          specs: JSON.stringify({ weightGrams: 120 + index * 35, warrantyMonths: 12 }, null, 2),
          gallery: [],
        }
      )
      await ProductVariant.query().where('product_id', product.id).delete()
      await ProductVariant.createMany(
        ['Standard', 'Limited'].slice(0, 1 + (index % 2)).map((variant, variantIndex) => ({
          productId: product.id,
          tenantId: tenant.id,
          name: `${variant} edition`,
          sku: `${product.sku}-${variantIndex + 1}`,
          color: PRODUCT_COLORS[(index + variantIndex) % PRODUCT_COLORS.length]!,
          stock: Math.floor(product.stock / (variantIndex + 1)),
          price: product.price + variantIndex * 15_000,
        }))
      )
      products.push(product)
    }

    for (let index = 0; index < 24; index++) {
      const [customerName, customerEmail, city] = CUSTOMERS[index % CUSTOMERS.length]!
      const status = ORDER_STATUSES[index % ORDER_STATUSES.length]!
      const placedAt = seedDate.minus({ days: index, hours: (index * 5) % 24 })
      const items: OrderItem[] = Array.from({ length: 1 + (index % 3) }, (_, line) => {
        const product = products[(index + line * 5) % products.length]!
        return {
          productId: product.id,
          productName: product.name,
          quantity: 1 + ((index + line) % 3),
          unitPrice: product.price,
        }
      })
      const number = `${skuPrefix}-${1001 + index}`
      const order = await Order.updateOrCreate(
        { number },
        {
          tenantId: tenant.id,
          number,
          customerName,
          customerEmail,
          customerPhone: index % 2 ? null : '8123456789',
          status,
          paymentMethod: (['card', 'transfer', 'cod'] as const)[index % 3]!,
          items,
          total: Order.totalFor(items),
          shippingAddress: { street: `Jalan Merdeka ${index + 1}`, city, postcode: '40115' },
          notes: index % 4 === 0 ? 'Leave the parcel at reception.' : null,
          isGift: index % 5 === 0,
          giftMessage: index % 5 === 0 ? 'Happy writing!' : null,
          source: (['web', 'retail', 'wholesale'] as const)[index % 3]!,
          placedAt,
        }
      )
      await OrderEvent.query().where('order_id', order.id).delete()
      const path = STATUS_PATHS[status]
      await OrderEvent.createMany(
        path.map((step, stepIndex) => ({
          orderId: order.id,
          tenantId: tenant.id,
          event: stepIndex === 0 ? 'Order placed' : `Marked ${step}`,
          note: stepIndex === 0 ? `Placed via ${order.source}` : null,
          actor: stepIndex === 0 ? customerName : 'Editorial Admin',
          fromStatus: stepIndex === 0 ? null : path[stepIndex - 1]!,
          toStatus: step,
          createdAt: placedAt.plus({ hours: stepIndex * 20 }),
        }))
      )
    }
  }
}
