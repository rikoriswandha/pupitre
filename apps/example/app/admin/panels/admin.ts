import { definePanel, nav } from '@rikology/pupitre'
import { shield } from '@rikology/pupitre-shield'
import { audit } from '@rikology/pupitre-audit'
import { resources, pages, widgets } from '#generated/admin'
import Post from '#models/post'
import type User from '#models/user'
import Tenant from '#models/tenant'
import adminTheme from '../themes/admin.js'

const adminPanel = definePanel('admin')
  .guard('web')
  .login()
  .passwordReset()
  .emailVerification()
  .profile()
  .mfa({ issuer: 'Pupitre Editorial' })
  .passkeys()
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
  .widgets([widgets['posts-by-status'], widgets['posts-per-month'], widgets['latest-posts']])
  .filters([
    {
      name: 'status',
      label: 'Post status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
      ],
    },
  ])
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
  .theme(adminTheme)
  .plugins([
    shield({
      userModel: () => import('#models/user'),
      resources: ['roles'],
      navigationGroup: 'Administration',
    }),
    audit({ resources: ['posts'], authorize: (ctx) => Boolean(ctx.auth.user) }),
  ])

const socialProviders = [
  ...(process.env.PUPITRE_FAKE_ALLY === 'true' ? ['fake'] : []),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? ['github'] : []),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? ['google'] : []),
]

export default socialProviders.length
  ? adminPanel.social({ providers: socialProviders, registration: true })
  : adminPanel
