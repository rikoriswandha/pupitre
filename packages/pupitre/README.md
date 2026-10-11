# @rikology/pupitre

Server-side, typed admin panels for AdonisJS. Define panels, resources, forms, tables, actions and plugins with the public builders exported by this package.

## Optional realtime integration

Configure a transport-neutral adapter in your Pupitre configuration. For AdonisJS Transmit, use `transmitRealtime()` from `@rikology/pupitre-transmit`:

```ts
import { defineConfig } from '@rikology/pupitre'
import { transmitRealtime } from '@rikology/pupitre-transmit'

export default defineConfig({ realtime: transmitRealtime() })
```

`realtime` also accepts an async factory. An adapter implements `driver`, `publish(channel, event): Promise<void>`, and optionally `initialize(manager)`. Pupitre resolves and initializes it after the jobs adapter and before plugin boot and route registration. The adapter must authorize subscriptions; enabling publishing alone must not expose private panel or tenant channels.

`realtimeChannels.user(panelId, userId)` and `realtimeChannels.resource(panelId, resourceSlug, tenantId?)` generate stable channels with each identifier URI-encoded:

- `pupitre/<panel>/users/<userId>`
- `pupitre/<panel>[/tenants/<tenantId>]/resources/<resourceSlug>`

Transport plugins reuse `realtimeChannels.patterns` for authorization registrations and `panelGuard(panel)` for the panel's effective guard.

Events contain no record data: `{ type: 'pupitre:notification' }` reloads the user's inbox and `{ type: 'pupitre:table', resource: slug }` invalidates a table. These names have no legacy aliases. Stored inbox messages publish to the user's channel in every panel with notifications enabled. Successful CRUD, inline edits, reorders, actions, imports, and relation mutations publish after persistence; queued mutations publish from the worker. Denied or rolled-back mutations do not publish.

Authenticated requests receive `pupitre.realtime: { driver, userChannel }`; anonymous requests do not. Resource list descriptors expose `realtime: { channel }`, and polled relation tables use their owning resource's channel. Channels include the resolved tenant ID. Attach the matching realtime client to the React renderer to subscribe; without a client the existing polling behavior remains unchanged.

## Audit activity

Pupitre reads activity; the host owns capture, migrations, storage, retention and redaction. Install and configure `@rikology/adonisjs-audit-trail` first, then configure the optional reader:

```ts
import { defineConfig } from '@rikology/pupitre'
import { auditAdapter } from '@rikology/pupitre/drivers/audit'

export default defineConfig({ audit: auditAdapter() })
```

The driver loads its optional peer only on a read. Automatic `Auditable` events use the Lucid constructor name. For explicitly assembled domain events or morph aliases, configure `auditAdapter({ auditableType: (model) => model.name === 'Post' ? 'article' : model.name })`. Values remain redacted exactly as stored by the peer.

`AuditAdapter.forRecord(model, id, { page, perPage, tenantId? })` returns normalized entries and pagination metadata. Hosts may implement this interface for another audit store's record timelines. The plugin's Activity resource specifically queries the audit-trail model; it is not backed by a custom adapter.

Record reads accept `AuditRecordOptions` (`{ page, perPage, tenantId? }`). The audit plugin supplies the active tenant even for globally shared records, so custom adapters must filter by the provided tenant ID rather than returning another tenant's history.

Timeline widgets use `defineWidget('history').timeline(async ({ ctx, record, filters }) => items)`. Each item has a title, ISO timestamp in `time`, optional description, actor, icon, color and changes (`{ field, old, new }`). Pupitre formats the timestamp using the current panel/user timezone and locale. Record timelines require `view` authorization, including when placed on edit pages; inaccessible timelines are omitted without blocking authorized edits.

Use `@rikology/pupitre-audit` for record history and the explicitly authorized Activity resource. Read-only resource definitions (no form, create/edit pages, editable/reorderable columns, relations or non-view actions) receive no mutation routes or implicit Delete action. Subject links can use asynchronous text-column and text-entry URL callbacks; columns receive the request `ctx` so links can honor the host's policy and tenant scope.
