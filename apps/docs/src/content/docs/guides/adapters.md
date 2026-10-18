---
title: "Adapters and drivers"
description: "Connect Pupitre to host mail, storage, queue and realtime infrastructure through optional adapters and drivers."
sidebar:
  label: "Adapters"
---

Pupitre can use the host's infrastructure without requiring every optional peer. Configure adapters in `config/pupitre.ts` using a value or `() => Promise<adapter>`. Installing an adapter package does not configure its database tables, mail transport or queue worker for you.

```ts
import { defineConfig } from '@rikology/pupitre'
import { mailDriver } from '@rikology/pupitre/drivers/mail'
import { jobsAdapter } from '@rikology/pupitre/drivers/queue'
import { notificationsAdapter } from '@rikology/pupitre/drivers/notifications'

export default defineConfig({
  mail: mailDriver({ from: 'admin@example.com' }),
  jobs: jobsAdapter(),
  notifications: notificationsAdapter(),
  storage: { disk: 'uploads' },
})
```

## Supported integration points

| Concern | Configuration and contract | Official driver / host dependency |
| --- | --- | --- |
| Jobs | `jobs`; dispatch/register/optional initialize | `jobsAdapter()` from `drivers/queue`, `@adonisjs/queue` |
| Notifications | `notifications`; toInbox/inbox/unreadCount/markRead | `notificationsAdapter()` from `drivers/notifications`, `@rikology/adonisjs-notifications` |
| Mail | `mail`; send message | `mailDriver({ from, mailer? })` from `drivers/mail`, `@adonisjs/mail` |
| Tenancy | Panel `tenancy.adapter`; resolve/scope/fill/list/switch/run | Column driver by default, `createTenantDriver(definition)` from `drivers/tenant` with `@rikology/adonisjs-tenant` |
| Storage | `storage.disk`, field `.disk()` | Host `@adonisjs/drive`; configure the named disk |
| Limiter | Host limiter manager, action `.rateLimit(...)` | `@adonisjs/limiter`, lazily used by auth/actions |
| Social auth | Panel `.social(...)`, host Ally providers | `@adonisjs/ally`; no separate social config adapter slot |
| Realtime | `realtime`; driver/publish/optional initialize(manager) | `transmitRealtime()` from `@rikology/pupitre-transmit`, `@adonisjs/transmit` |
| Audit reads | `audit`; forRecord returning normalized pages | `auditAdapter()` from `drivers/audit`, `@rikology/adonisjs-audit-trail` |

Driver module paths are `@rikology/pupitre/drivers/<name>`. Limiter and Ally helpers are runtime integration details, not factories to pass to `defineConfig`. Storage is a Drive disk setting, not an exported `storageAdapter()` factory. Optional peers are loaded lazily so unused features do not break host boot; missing required peers report clear integration errors.

## Jobs and lifecycle

`JobsAdapter` provides `dispatch(job, payload)`, `register(job, handler)` and optional `initialize()`. Pupitre registers fixed export/import/bulk handlers at boot. Payloads contain identities and storage references; a worker reloads user/tenant/records using scoped queries. Configure the host queue worker and durable storage. Handler context is not a live HTTP request/response.

Without a jobs adapter, async bulk/import falls back to synchronous execution. That does not remove import/export row limits. Set `exports: { maxSyncRows, maxAsyncRows, retentionMinutes }` intentionally and schedule `pupitre:prune`.

## Mail, inbox and limits

Password reset/verification require mail delivery. `mailDriver` requires `from` and optionally `mailer`. Database notifications require the notifications peer's persistence/channel configuration; toast feedback does not need inbox storage.

Auth endpoints enforce attempt limits even without the optional limiter, using a bounded in-memory fallback for a single process. At its 10,000-key capacity the fallback evicts the oldest insertion-order key, so identity churn can forget active quotas. Multi-worker or multi-instance deployments must configure a shared-store `@adonisjs/limiter`; an installed but broken limiter is not ignored. Ordinary action `.rateLimit()` is still fail-open when the host limiter is absent, so configure it before relying on action quotas. See [authentication limits](/guides/auth/#rate-limits).

Implement custom interfaces using the exact [configuration reference](/reference/api-configuration/) and keep application authorization and tenant ownership intact. A driver is an infrastructure bridge, not a reason to trust client state.

## Realtime adapters

```ts
import { transmitRealtime } from '@rikology/pupitre-transmit'
import { auditAdapter } from '@rikology/pupitre/drivers/audit'

// Merge these keys into your existing defineConfig call:
const infrastructure = { realtime: transmitRealtime(), audit: auditAdapter() }
```

Both keys accept an adapter or a lazy adapter loader. The server realtime contract is:

```ts
interface RealtimeAdapter {
  driver: string
  publish(channel: string, event: RealtimeEvent): Promise<void>
  initialize?(manager: PupitreManager): void | Promise<void>
}
```

`RealtimeEvent` is `{ type: 'pupitre:notification' }` or `{ type: 'pupitre:table', resource: string }`. A transport owns channel authorization; never publish sensitive record data. Notification pings go to the user's channel in every notifications-enabled panel. The browser contract, exported from `@rikology/pupitre/catalog`, is `subscribe(channel, onEvent): () => void`, where the returned function unsubscribes. Pass that client to `<Pupitre realtime={client} registry={registry} />`; server configuration alone does not connect the browser. See [Transmit setup and authorization](/plugins/transmit/).

## Audit read adapters

```ts
interface AuditAdapter {
  forRecord(
    model: LucidModel,
    id: string | number,
    options?: { page?: number; perPage?: number; tenantId?: string }
  ): Promise<AuditPage>
}
```

`AuditPage` contains `items: AuditEntry[]` and `meta: { total, perPage, currentPage, lastPage }` (all numbers). Each entry has `id`, `event`, nullable `auditableType`/`auditableId`, nullable `actor: { type, id, label? }`, `changes: { field, old, new }[]`, `tags: string[]` and an ISO `createdAt`. See the [exact types](/reference/api-configuration/).

`auditAdapter({ auditableType? })` defaults to the model class name and reads the audit-trail peer lazily. It does not capture events. Custom stores must enforce the supplied tenant constraint; an adapter must not leak histories across tenants just because record IDs coincide. `AuditAdapter` exposes only `forRecord`, not `recent`. The [Audit plugin](/plugins/audit/) uses this adapter for record timelines, but its built-in Activity resource is audit-trail-model specific and reads that peer directly. Disable Activity and supply an authorized host page when using another history store.
