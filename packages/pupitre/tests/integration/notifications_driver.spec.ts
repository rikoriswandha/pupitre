import { createRequire } from 'node:module'
import { test } from '@japa/runner'
import { closeTestApp, createTestApp, User } from '../helpers/app.js'
import { notificationsAdapter } from '../../src/drivers/notifications.js'

const require = createRequire(import.meta.url)
let hasPeer = true
try {
  require.resolve('@rikology/adonisjs-notifications')
} catch {
  hasPeer = false
}

test('official notifications driver persists, lists, counts, and marks peer inbox rows', async ({
  assert,
}) => {
  const { channels, defineConfig } = await import('@rikology/adonisjs-notifications')
  const notificationsConfig = defineConfig({
    channels: { database: channels.database() },
    delivery: { recordAttempts: false, failFast: true },
  })
  const fixture = await createTestApp({
    providers: [() => import('@rikology/adonisjs-notifications/notification_provider')],
    config: { notifications: notificationsConfig },
  })
  try {
    const user = await User.create({
      name: 'Driver User',
      fullName: 'Driver User',
      email: 'driver@example.com',
    })
    const adapter = notificationsAdapter()
    const adapterContext = { containerResolver: fixture.app.container } as never
    await adapter.toInbox(user, {
      type: 'success',
      title: 'Persisted',
      body: 'Stored by the peer',
      url: '/admin/posts/1',
      actions: [
        { label: 'View', url: '/admin/posts/1' },
        { label: 'Mark read', markAsRead: true },
      ],
    })
    const inbox = await adapter.inbox(user, { page: 1, perPage: 10 }, adapterContext)
    assert.lengthOf(inbox.items, 1)
    assert.deepEqual(inbox.items[0].actions, [
      { label: 'View', url: '/admin/posts/1' },
      { label: 'Mark read', markAsRead: true },
    ])
    assert.equal(inbox.items[0].title, 'Persisted')
    assert.equal(inbox.items[0].body, 'Stored by the peer')
    assert.equal(inbox.items[0].type, 'success')
    assert.equal(await adapter.unreadCount(user, adapterContext), 1)
    await adapter.markRead(user, [inbox.items[0].id], adapterContext)
    assert.equal(await adapter.unreadCount(user, adapterContext), 0)
    const { Notification } = await import('@rikology/adonisjs-notifications')
    class HostNotification extends Notification {
      via() {
        return ['database']
      }

      toDatabase() {
        return { title: 'Host notice' }
      }
    }
    const { default: notifications } =
      await import('@rikology/adonisjs-notifications/services/main')
    await notifications.sendNow(user, new HostNotification())
    const hostInbox = await adapter.inbox(user, { page: 1, perPage: 10 }, adapterContext)
    assert.equal(hostInbox.items.find((item) => item.title === 'Host notice')?.type, 'info')
    assert.equal(await adapter.unreadCount(user, adapterContext), 1)
  } finally {
    await closeTestApp(fixture)
  }
}).skip(() => !hasPeer, 'Optional @rikology/adonisjs-notifications peer is not installed')
