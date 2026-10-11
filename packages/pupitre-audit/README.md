# @rikology/pupitre-audit

Server-only activity plugin for Pupitre. It contributes core timeline specs, not React components, and uses `@rikology/adonisjs-audit-trail` for the read-only Activity resource.

## Installation

Install this package, Pupitre, and `@rikology/adonisjs-audit-trail`. Configure the audit-trail provider, its `config/audit.ts`, and its published migrations following the peer package instructions. Apply `Auditable` to the models you want recorded. Pupitre does not duplicate the peer's logging pipeline or tables.

```ts
// config/pupitre.ts
import { defineConfig } from '@rikology/pupitre'
import { auditAdapter } from '@rikology/pupitre/drivers/audit'

export default defineConfig({ audit: auditAdapter() })
```

```ts
// app/admin/panels/admin.ts
import { audit } from '@rikology/pupitre-audit'

// Add to your panel builder:
.plugins([
  audit({
    resources: ['posts'],
    pages: ['view', 'edit'],
    activity: { slug: 'activity', navigationGroup: 'System', label: 'Activity' },
    perPage: 25,
    authorize: (ctx) => Boolean(ctx.auth.user),
  }),
])
```

Replace the demonstration authorization with your application permission check. Without `authorize`, `config.pupitre.policies` must export `AuditPolicy` or `ActivityPolicy` with `viewAny` and `view` methods; otherwise Activity is denied. `authorize(ctx, record?)` is invoked for list access and record access separately.

## Options

- `resources`: `'all'` (default) or resource slugs. Existing view/edit pages receive a footer timeline; pages are never created implicitly.
- `pages`: `['view', 'edit']` by default. Existing widgets are preserved.
- `activity`: options above, or `false` to disable the Activity resource/navigation.
- `perPage`: 1–100; default 25. Limits the most recent entries per record timeline and sets the first activity table page-size choice.
- `authorize`: explicit asynchronous or synchronous activity authorization callback.

Record timelines require `config.pupitre.audit`. The core enforces record `view` authorization even on an edit-page widget endpoint. Activity has list and view pages only, no form, create/edit/delete routes, or write actions. Filters accept exact event names (including custom events such as `model.updated`), exact subject types, and an inclusive UTC date range. Detail displays old/new JSON values and actor metadata. The local read-only Audit subclass supports peer-assigned UUIDs and normalizes SQLite ISO timestamps as well as PostgreSQL dates.

Tenant panels restrict Activity queries by `tenant_id`, independently of the host resource ownership column, and reject detail access for another tenant. Subject links in both the table and detail require a registered top-level resource, `viewAny`, scoped record lookup, and record `view` authorization. A view page is preferred; an edit-only resource additionally requires `update` authorization before linking to edit. Deleted, unmapped, nested, or denied subjects have no link. The default discriminator is the model class name; custom adapter discriminators that do not match a model name remain unlinked.

Record timelines also pass the active `tenantId` to `AuditAdapter.forRecord`, including for shared resources declared `.scope(false)`. A custom audit adapter must honor that constraint; histories with no resolved tenant are not loaded in tenant panels.

Custom adapters implement only `forRecord(model, id, options)` and drive record timelines. Activity is audit-trail-model specific, queries that peer directly, and uses the built-in `activity` icon; it does not query a custom adapter.

The plugin shows audit history; it does not provide audit retention, redaction, chain verification, or capture guarantees. Configure these in the audit-trail package. With best-effort delivery, newly generated events may appear after its flush interval.
