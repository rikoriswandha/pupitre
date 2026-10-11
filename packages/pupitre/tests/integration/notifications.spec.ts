import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type {
  NotificationsAdapter,
  PupitreNotificationItem,
} from '../../src/adapters/notifications.js'
import { executeAction } from '../../src/compiler/action_compiler.js'
import { action, definePanel } from '../../index.js'
import { closeTestApp, createTestApp, User } from '../helpers/app.js'
import { notificationListResponse } from '../../catalog/wire.js'

const notification = (id: string, userId: number): PupitreNotificationItem => ({
  id,
  type: 'success',
  title: `Notification ${id}`,
  readAt: null,
  createdAt: '2026-10-11T00:00:00.000Z',
  url: `/posts/${userId}`,
})

function memoryAdapter() {
  const items = new Map<number, PupitreNotificationItem[]>()
  const marked: Array<{ userId: number; ids: string[] | 'all' }> = []
  const adapter: NotificationsAdapter = {
    async toInbox(user, message) {
      const id = Number((user as unknown as User).id)
      items.set(id, [
        ...(items.get(id) ?? []),
        { ...message, id: `item-${id}`, readAt: null, createdAt: new Date().toISOString() },
      ])
    },
    async inbox(user, options) {
      const all = items.get(Number((user as unknown as User).id)) ?? []
      const start = (options.page - 1) * options.perPage
      return {
        items: all.slice(start, start + options.perPage),
        meta: {
          total: all.length,
          perPage: options.perPage,
          currentPage: options.page,
          lastPage: Math.max(1, Math.ceil(all.length / options.perPage)),
        },
      }
    },
    async unreadCount(user) {
      return (items.get(Number((user as unknown as User).id)) ?? []).filter((item) => !item.readAt)
        .length
    },
    async markRead(user, ids) {
      const userId = Number((user as unknown as User).id)
      marked.push({ userId, ids })
      const own = items.get(userId) ?? []
      const selected = ids === 'all' ? null : new Set(ids)
      items.set(
        userId,
        own.map((item) =>
          !selected || selected.has(item.id) ? { ...item, readAt: new Date().toISOString() } : item
        )
      )
    },
  }
  return { adapter, items, marked }
}

test.group('Pupitre notifications', () => {
  test('serves only the current user inbox with pagination and mark-read', async ({ assert }) => {
    const memory = memoryAdapter()
    const panel = definePanel('admin')
      .path('/admin')
      .guard('web')
      .login()
      .resources([])
      .notifications({ interval: 30_000 })
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: panel }) },
      pupitre: { notifications: memory.adapter },
    })
    try {
      const user = await User.create({
        name: 'Inbox User',
        fullName: 'Inbox User',
        email: 'inbox@example.com',
      })
      const other = await User.create({
        name: 'Other User',
        fullName: 'Other User',
        email: 'other@example.com',
      })
      memory.items.set(
        Number(user.id),
        Array.from({ length: 21 }, (_, index) => notification(`own-${index}`, Number(user.id)))
      )
      memory.items.set(Number(other.id), [notification('other-only', Number(other.id))])
      const unauthenticated = await new ApiClient(fixture.baseUrl)
        .get('/admin/_pupitre/notifications')
        .header('Accept', 'application/json')
        .send()
      assert.equal(unauthenticated.status(), 401)
      const cookies = await fixture.loginAs(user)
      const response = await new ApiClient(fixture.baseUrl)
        .get('/admin/_pupitre/notifications?page=2')
        .header('Cookie', cookies)
        .header('Accept', 'application/json')
        .send()
      assert.equal(response.status(), 200, response.text())
      assert.isTrue(notificationListResponse.safeParse(response.body()).success)
      assert.lengthOf(response.body().items, 1)
      assert.equal(response.body().items[0].id, 'own-20')
      assert.equal(response.body().unread, 21)
      assert.deepEqual(response.body().meta, {
        total: 21,
        perPage: 20,
        currentPage: 2,
        lastPage: 2,
      })

      const read = await new ApiClient(fixture.baseUrl)
        .post('/admin/_pupitre/notifications/read')
        .header('Cookie', cookies)
        .header('Accept', 'application/json')
        .json({ ids: ['own-20', 'other-only'] })
        .send()
      assert.equal(read.status(), 204)
      assert.deepEqual(memory.marked, [{ userId: Number(user.id), ids: ['own-20', 'other-only'] }])
      assert.equal(await memory.adapter.unreadCount(user), 20)
      assert.equal(await memory.adapter.unreadCount(other), 1)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('returns 404 when the panel has notifications disabled', async ({ assert }) => {
    const fixture = await createTestApp({ panelGuard: 'web' })
    try {
      const user = await User.create({
        name: 'Inbox User',
        fullName: 'Inbox User',
        email: 'disabled@example.com',
      })
      const cookies = await fixture.loginAs(user)
      const response = await new ApiClient(fixture.baseUrl)
        .get('/admin/_pupitre/notifications')
        .header('Cookie', cookies)
        .header('Accept', 'application/json')
        .send()
      assert.equal(response.status(), 404)
    } finally {
      await closeTestApp(fixture)
    }
  })
  test('builds tray props only for an enabled panel with an adapter and user', async ({
    assert,
  }) => {
    const memory = memoryAdapter()
    const { notificationProps } = await import('../../src/notifications/props.js')
    const ctx = {
      pupitre: {
        panel: { path: '/admin/acme', notifications: { interval: 30_000 } },
        authUser: { id: 9 } as unknown as LucidRow,
      },
      containerResolver: { make: async () => ({ notifications: memory.adapter }) },
    } as never
    assert.deepEqual(await notificationProps(ctx), {
      unread: 0,
      url: '/admin/acme/_pupitre/notifications',
      readUrl: '/admin/acme/_pupitre/notifications/read',
      interval: 30_000,
    })
  })

  test('sends database notifications through a configured adapter', async ({ assert }) => {
    const memory = memoryAdapter()
    const ctx = {
      pupitre: { authUser: { id: 7 } as unknown as LucidRow },
      containerResolver: { make: async () => ({ notifications: memory.adapter }) },
      logger: { child: () => ({ warn() {} }) },
    } as never
    const operation = action('notify-test').handle(async ({ notify }) => {
      await notify?.success('Done').body('Saved').sendToDatabase()
    }).definition
    const result = await executeAction(operation, {
      ctx,
      data: {},
      authorize: async () => true,
      currentUrl: '/admin/posts',
      listUrl: '/admin/posts',
    })
    assert.isEmpty(result.flash)
    assert.equal((memory.items.get(7) ?? [])[0]?.title, 'Done')
    assert.equal((memory.items.get(7) ?? [])[0]?.body, 'Saved')
  })

  test('keeps flash notification behavior and skips database delivery without adapter', async ({
    assert,
  }) => {
    let warnings = 0
    const ctx = {
      pupitre: { authUser: { id: 8 } as unknown as LucidRow },
      containerResolver: { make: async () => ({}) },
      logger: {
        child: () => ({
          warn() {
            warnings++
          },
        }),
      },
    } as never
    const operation = action('flash-only').handle(async ({ notify }) => {
      notify?.success('Saved').body('Flash body').send()
      await notify?.success('Saved').sendToDatabase()
    }).definition
    const result = await executeAction(operation, {
      ctx,
      data: {},
      authorize: async () => true,
      currentUrl: '/admin/posts',
      listUrl: '/admin/posts',
    })
    assert.deepEqual(result.flash, [{ type: 'success', title: 'Saved', body: 'Flash body' }])
    assert.equal(warnings, 1)
  })
})
