import { media } from '@rikology/pupitre-media'
import { databaseBackups } from '../backup.js'
import { calendarDemo } from '../calendar_demo.js'
import { ordersKanban } from '../kanban.js'
import { definePanel, nav } from '@rikology/pupitre'
import { shield } from '@rikology/pupitre-shield'
import { audit } from '@rikology/pupitre-audit'
import { settings } from '@rikology/pupitre-settings'
import { generalSettings, tenantSettings } from '../settings.js'
import { resources, pages, widgets } from '#generated/admin'
import Post from '#models/post'
import type User from '#models/user'
import Tenant from '#models/tenant'
import adminTheme from '../themes/admin.js'
import { ratingPlugin } from '../extensions/rating.js'
import { health } from '@rikology/pupitre-health'
import healthChecks from '#start/health'
import { jobs } from '@rikology/pupitre-jobs'
import { jobsDemo } from '../plugins/jobs_demo.js'

const adminPanel = definePanel('admin')
  .impersonation()
  .environmentIndicator({ visible: true })
  .guard('web')
  .login()
  .passwordReset()
  .emailVerification()
  .profile()
  .sessions()
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
  .locales(['en', 'id'])
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
        'media',
      ]),
    nav.group('Administration').sort(20).items(['users']),
    nav
      .group('Showcase')
      .sort(25)
      // Explicit item sorts keep the tour order; equal sorts fall back to label order.
      .items([
        nav.item().page('store-overview').sort(1),
        nav.item().resource('products').sort(2),
        nav.item().resource('orders').sort(3),
        nav.item().page('form-playground').sort(4),
        nav.item().page('tour').sort(5),
      ]),
    nav.item('Documentation').url('https://pupitre.rikology.com').external(),
  ])
  .userMenu([
    { label: 'Pupitre website', url: 'https://pupitre.rikology.com', external: true, sort: 10 },
  ])
  .theme(adminTheme)
  .plugins([
    media({
      disk: 'uploads',
      visibility: 'private',
      tenancy: true,
      authorize: (ctx) => (ctx.auth.user as User | undefined)?.email === 'admin@example.com',
    }),
    databaseBackups,
    jobs({
      navigationGroup: 'Administration',
      authorize: (ctx) => (ctx.auth.user as User | undefined)?.email === 'admin@example.com',
      allowRetry: (_ctx, run) => run.name === 'MonitorDemoJob',
    }),
    jobsDemo,
    calendarDemo,
    ordersKanban,
    ratingPlugin,
    health({
      checks: healthChecks,
      authorize: (ctx) => (ctx.auth.user as User | undefined)?.email === 'admin@example.com',
    }),
    shield({
      userModel: () => import('#models/user'),
      resources: ['roles'],
      navigationGroup: 'Administration',
    }),
    audit({ resources: ['posts'], authorize: (ctx) => Boolean(ctx.auth.user) }),
    settings({
      groups: [generalSettings, tenantSettings],
      authorize: (ctx) => Boolean(ctx.auth.user),
    }),
  ])

const socialProviders = [
  ...(process.env.PUPITRE_FAKE_ALLY === 'true' ? ['fake'] : []),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? ['github'] : []),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? ['google'] : []),
]

export default socialProviders.length
  ? adminPanel.social({ providers: socialProviders, registration: true })
  : adminPanel
