import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Post from '#models/post'
import Comment from '#models/comment'
import Tenant from '#models/tenant'
import Tag from '#models/tag'
import User from '#models/user'

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
    }
  }
}
