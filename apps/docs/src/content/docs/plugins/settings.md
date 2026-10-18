---
title: "Settings: typed settings"
description: "Define typed settings groups with transactional persistence, defaults and tenant-isolated panel pages."
sidebar:
  label: "Settings"
---

Settings groups turn typed configuration into panel forms backed by transactional storage. Choose a global or tenant scope and an explicit access policy for each workflow.

Install `@rikology/pupitre-settings`, run `node ace add @rikology/pupitre-settings`, then `node ace migration:run`. The configure hook publishes an idempotent migration for `pupitre_settings`.

```ts
import { t, definePanel } from '@rikology/pupitre'
import { defineSettings, settings, settingsFor, saveSettings } from '@rikology/pupitre-settings'

export const general = defineSettings('general')
  .label(t('General'))
  .icon('settings')
  .sort(1)
  .form((s) => [
    s.text('siteName').required().maxLength(120),
    s.toggle('maintenanceMode'),
    s.number('itemsPerPage').min(1).max(100),
    s.keyValue('metadata'),
  ])
  .defaults({ siteName: 'Pupitre', maintenanceMode: false, itemsPerPage: 25, metadata: {} })
  .scope('global')

export default definePanel('admin').plugins([
  settings({ groups: [general], navigationGroup: t('Settings'), authorize: (ctx) => Boolean(ctx.auth.user?.isAdmin) }),
])

const values = await settingsFor(general) // inferred from defaults
await saveSettings(general, { maintenanceMode: true })
```

`defaults()` defines the public typed keys. Every writable form field must have a default; plugin registration rejects missing defaults, including fields inside layouts. Repeater and builder children belong to their enclosing setting, not separate keys. Reads merge defaults and ignore obsolete stored keys. Programmatic saves reject unknown keys and validate merged values before opening a write transaction. Generated pages persist the controller's already-validated output without repeating date conversion or dehydration. One atomic upsert writes the patch on SQLite and PostgreSQL; concurrent first saves do not race on the identity index. Invalid input and database failures leave no partially applied patch. Booleans, numbers and JSON objects retain their types; JSON editors return strings, while key-value/repeater/builder fields return structured JSON.

Groups generate custom pages using the existing page renderer, fill/save flow, actions, navigation and validation. `general` uses `/settings`; other groups use `/settings-<group>`. `.actions([...])` adds ordinary page actions.

## Deny-by-default

No `authorize` callback and no host `SettingsPolicy` means no navigation and HTTP 403. The policy must implement both `viewAny(user)` (settings navigation access) and `manage(user, group)` (group editor access). Both gates must pass to expose a group in navigation or read/write its page; links never advertise inaccessible editors. There is no implicitly public or read-only settings editor. The callback receives `(ctx, group)` and must return an explicit boolean.

For Shield, pass `authorize: (ctx, group) => shieldCan(\`settings.${group.name}\`)(ctx)` and explicitly create/assign those custom permissions; Shield sync cannot infer permissions from arbitrary callbacks. This does not override tenant boundaries.

Programmatic `settingsFor`/`saveSettings` are trusted server APIs for commands/jobs, not HTTP authorization endpoints. Authorize their callers yourself.

## Tenant groups

Use `.scope('tenant')` and a panel tenancy adapter. Generated pages use the tenant already resolved and membership-checked by Pupitre. Outside HTTP, pass `{ tenant: { id: tenantId } }` explicitly. Within HTTP, an explicit tenant must match the active tenant, otherwise both reads and writes reject it. Missing tenant context is an error, never a global fallback.

Tenant identity is `tenant:<id>`; global identity is `global`. The non-null `scope_key` plus group and key has a unique index, so global settings work consistently on PostgreSQL and SQLite. Settings groups are shared across panels by group name and tenant ID; use distinct names when separate panel data is needed.

## Cache, storage and audit

Reads cache only inside the current `HttpContext` and return defensive copies. A successful save invalidates the matching request entry. There is no cross-process cache to become stale; command/job reads query the database. `clearSettingsCache(ctx?)` discards the current request cache explicitly.

Values use JSON `{ value: ... }` envelopes, avoiding ambiguity between PostgreSQL's decoded scalar strings and SQLite's JSON text. Persistence sets timestamps and preserves `created_at` on conflict. Existing hosts must backfill old key/value tables; the example migration copies the four general keys, converts the legacy boolean once, and preserves its old table because the form playground still uses it.

The core audit adapter only supports `forRecord` reads, not capture. This plugin therefore does not claim to emit audit entries through that adapter. Hosts requiring settings audit capture should integrate their audit writer in a server-owned save workflow, with explicit redaction for sensitive values.
