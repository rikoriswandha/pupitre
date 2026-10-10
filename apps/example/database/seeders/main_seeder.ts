import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import Category from '#models/category'
import Post from '#models/post'
import User from '#models/user'

export default class MainSeeder extends BaseSeeder {
  async run() {
    const admin = await User.updateOrCreate(
      { email: 'admin@example.com' },
      { fullName: 'Editorial Admin', password: 'password', timezone: 'Asia/Jakarta' }
    )
    await User.updateOrCreate(
      { email: 'editor@example.com' },
      { fullName: 'Editorial Editor', password: 'password', timezone: null }
    )

    const categories = await Promise.all([
      Category.updateOrCreate({ slug: 'culture' }, { name: 'Culture', slug: 'culture' }),
      Category.updateOrCreate({ slug: 'design' }, { name: 'Design', slug: 'design' }),
      Category.updateOrCreate({ slug: 'technology' }, { name: 'Technology', slug: 'technology' }),
    ])

    const seedDate = DateTime.fromISO('2026-10-10T12:00:00.000Z', { zone: 'utc' })
    for (let index = 1; index <= 30; index++) {
      const published = index % 3 !== 0
      const publishedAt = published ? seedDate.minus({ days: index * 3 }) : null
      await Post.updateOrCreate(
        { slug: `field-notes-${index.toString().padStart(2, '0')}` },
        {
          title: `Field Notes ${index.toString().padStart(2, '0')}`,
          slug: `field-notes-${index.toString().padStart(2, '0')}`,
          status: published ? 'published' : 'draft',
          body: `<p>Editorial note ${index} from the Pupitre dogfood journal.</p>`,
          isFeatured: index % 5 === 0,
          publishedAt,
          viewsCount: index * 17,
          categoryId: categories[(index - 1) % categories.length]!.id,
          authorId: admin.id,
          items: [
            { sku: `NOTE-${index}`, qty: index % 4 + 1, price: index * 1250 },
            { sku: `INK-${index}`, qty: 2, price: 8500 },
          ],
        }
      )
    }
  }
}
