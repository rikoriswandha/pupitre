import { definePanel, nav } from '@rikology/pupitre'
import { resources, pages } from '#generated/admin'
import Tenant from '#models/tenant'
import Post from '#models/post'
import type User from '#models/user'

export default definePanel('admin')
  .guard('web')
  .login()
  .passwordReset()
  .emailVerification()
  .profile()
  .tenancy({
    mode: 'url',
    model: () => import('#models/tenant'),
    tenantsForUser: (user) =>
      Tenant.query()
        .join('tenant_user', 'tenant_user.tenant_id', 'tenants.id')
        .where('tenant_user.user_id', (user as User).id)
        .select('tenants.*'),
  })
  .brand({ name: 'Pupitre Editorial' })
  .timezone('Asia/Jakarta')
  .notifications({ interval: 30_000 })
  .pages(pages)
  .resources(resources)
  .navigation([
    nav
      .group('Content')
      .sort(10)
      .items([
        nav
          .item()
          .resource('posts')
          .badge(async (ctx) => {
            const query = Post.query().where('status', 'draft')
            if (ctx.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
            const [count] = await query.count('* as total')
            return Number(count?.$extras.total ?? 0)
          }),
        'categories',
      ]),
    nav.group('Administration').sort(20).items(['users']),
    nav
      .group('System')
      .sort(30)
      .items([nav.item().page('settings')]),
    nav.item('Documentation').url('https://pupitre.dev/docs').external(),
  ])
  .userMenu([{ label: 'Pupitre website', url: 'https://pupitre.dev', external: true, sort: 10 }])
  .theme({ primary: 'oklch(0.55 0.18 255)', darkMode: 'system', radius: '0.5rem' })
