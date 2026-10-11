---
title: Notifications
sidebar:
  order: 12
---

Action handlers (including custom-page actions) receive notification builders. A custom page's `save({ data, ctx })` callback does not receive `notify`. Toasts and persisted inbox messages are distinct delivery paths.

```ts
import { notificationAction } from '@rikology/pupitre'

// Inside a handler with a notify builder:
notify?.success('Saved')
  .body('Your changes are ready.')
  .actions([notificationAction('Open post').url('/admin/posts/1').markAsRead()])
  .send()
```

Available severity methods are success, danger/error, warning and info. `.body()` adds text, `.actions([...])` adds links, `.send()` sends flash/toast feedback. `.sendToDatabase(user?)` persists through the configured notifications adapter; await it. Do not describe a toast as durable delivery.

## Inbox

Enable panel `.notifications({ interval: 30_000 })`; the default interval is 30 seconds. The tray supports paginated inbox results and marking read. Use `.notifications(false)` to disable it. Without a notifications adapter, database persistence is not available.

The official `notificationsAdapter()` from `@rikology/pupitre/drivers/notifications` integrates `@rikology/adonisjs-notifications`. Configure its database channel/storage in the host. Custom `NotificationsAdapter` implementations provide toInbox, inbox, unreadCount and markRead with the exact normalized message shape in the [configuration reference](/reference/api-configuration/).

Notification actions are serialized labels/URLs/methods/read flags, not callback functions. Use authorized destinations and avoid sensitive record content in user-visible messages.
