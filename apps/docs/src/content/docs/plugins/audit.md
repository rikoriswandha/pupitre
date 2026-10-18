---
title: "Audit: activity and timelines"
description: "Display host-recorded audit activity in a read-only resource and add record timelines without replacing event capture."
sidebar:
  label: "Audit"
---

`@rikology/pupitre-audit` displays audit history. It does not capture events itself or replace the host's audit retention, redaction, delivery or verification policy.

## Install and configure

```sh
npm install @rikology/pupitre-audit
node ace add @rikology/adonisjs-audit-trail
node ace migration:run
```

For an already installed audit-trail peer, run `node ace configure @rikology/adonisjs-audit-trail`. Follow the peer's setup for its provider, `config/audit.ts`, store and migrations, and apply its `Auditable` mixin to models you want recorded. The example application registers `@rikology/adonisjs-audit-trail/audit_provider` and configures a Lucid store in `config/audit.ts`; installing the display plugin alone does not create history.

Configure the core read adapter separately:

```ts
// config/pupitre.ts
import { defineConfig } from '@rikology/pupitre'
import { auditAdapter } from '@rikology/pupitre/drivers/audit'

export default defineConfig({ audit: auditAdapter() })
```

The driver loads the optional peer when reading, normalizes actor metadata and old/new changes, and sorts newest first. Its only factory option is `auditableType?: (model: LucidModel) => string`; the default discriminator is the model class name.

`AuditAdapter` exposes only `forRecord(model, id, options?)`, returning a normalized `AuditPage`; there is no `recent()` method. Custom adapters supply record timelines. The built-in Activity resource is specific to the audit-trail model and queries that peer directly, rather than reading a custom adapter.

## Register on a panel

```ts
import { audit } from '@rikology/pupitre-audit'

panel.plugins([
  audit({
    resources: ['posts'],
    pages: ['view', 'edit'],
    activity: { slug: 'activity', navigationGroup: 'System', label: 'Activity' },
    perPage: 25,
  }),
])
```

| Option | Meaning |
| --- | --- |
| `resources` | `'all'` (default) or resource slug array receiving timelines |
| `pages` | Existing page kinds receiving timelines; default `['view', 'edit']` |
| `activity` | `{ slug?, navigationGroup?, label? }` or `false` to disable the Activity resource/navigation |
| `perPage` | Integer 1–100, default 25; recent timeline limit and first Activity page-size choice |
| `authorize` | `(ctx: HttpContext, record?: Audit) => boolean \| Promise<boolean>` for Activity access |

Default Activity slug/label/group are `activity`, `Activity` and `System`. Existing page widgets are preserved and timelines append to footer widgets; missing pages are not created.

## Deny-by-default Activity access

Without `authorize`, the host's `config.pupitre.policies` loader must expose `AuditPolicy` or `ActivityPolicy`. Implement `viewAny` for list access and `view` for record access. Missing policy, missing method or missing Bouncer denies access. The first configured `AuditPolicy` takes precedence over `ActivityPolicy`.

Alternatively, supply `authorize(ctx, record?)` with your actual application permission check. The callback is called separately for list access (no record) and detail access (record present). A signed-in user alone is not necessarily entitled to read sensitive audit values. The example's authenticated-user callback is demonstration wiring, not a recommended production permission policy.

Activity has list/view pages, exact event and subject-type filters, an inclusive UTC date-range filter, actor metadata and old/new JSON details. It has no create/edit/delete routes or write actions, and its explicit policy denies mutations. Shield does not replace this explicit Activity policy; grant Activity access through the callback or host policy instead.

Subject links require a registered top-level resource, `viewAny`, a scoped record lookup and record `view` authorization. View is preferred; an edit-only resource also requires `update`. Deleted, nested, unmapped or denied subjects are not linked. A custom discriminator that does not match a registered model class name is not linked.

## Record timelines and custom timelines

Record timelines use `config.pupitre.audit` and display event, timestamp, actor and changes. The core checks record `view` authorization even for an edit-page timeline endpoint. The timeline displays the newest `perPage` entries; it is not a paginated audit browser. With best-effort audit-trail delivery, history may appear after its flush interval.

Use the core widget API for other histories; no audit plugin is required for a custom loader:

```ts
import { defineWidget } from '@rikology/pupitre'

export const releaseHistory = defineWidget('release-history')
  .heading('Release history')
  .timeline(() => [{
    title: 'Released',
    time: '2026-10-11T09:00:00.000Z',
    actor: 'Release team',
    changes: [{ field: 'status', old: 'draft', new: 'published' }],
  }])
```

This fixed item illustrates the shape; use your authorized server data in a real loader. See [timeline widgets](/guides/widgets/#timeline-widgets) for optional fields and placement.

## Tenant isolation

Activity queries filter `tenant_id` in tenant panels, and detail access rejects another tenant's record. Configure the audit-trail tenant resolver so captured entries carry the correct tenant identity; the example resolves the route tenant slug because audit middleware runs before Pupitre's tenant resolution.

Record timelines pass the active `tenantId` to `AuditAdapter.forRecord`, including shared `.scope(false)` resources. No history is loaded in a tenant panel without a resolved tenant. **Custom adapters must honor `tenantId`**; resource lookup isolation does not automatically isolate an external history store. The built-in Activity resource still reads the audit-trail model directly, even if you replace the timeline read adapter. For another storage system, disable `activity` and provide your own authorized activity page.
