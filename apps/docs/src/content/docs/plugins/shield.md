---
title: "Shield: roles and permissions"
description: "Install database-backed roles and resource permissions and connect generated policies to AdonisJS Bouncer."
sidebar:
  label: "Shield"
---

`@rikology/pupitre-shield` adds a Roles resource and generic Bouncer policies. Install it in the host AdonisJS application:

```sh
node ace add @rikology/pupitre-shield
# If the package is already installed:
node ace configure @rikology/pupitre-shield
node ace migration:run
```

Configure registers `@rikology/pupitre-shield/commands` and publishes `1791700000037_create_pupitre_shield_tables.ts` without replacing an existing migration. No separate Shield provider is required. The migration creates `pupitre_roles`, `pupitre_permissions`, `pupitre_role_user` and `pupitre_permission_role`. Before migrating, adapt the integer `user_id` foreign key if your users have UUID/custom primary keys. For another users table, configure with `--user-table=accounts`.

## Register on a panel

```ts
import { shield } from '@rikology/pupitre-shield'

// Add to your existing panel builder:
panel.plugins([
  shield({
    userModel: () => import('#models/user'),
    superAdminRole: 'super-admin',
    resources: 'all',
    except: ['billing'],
    navigationGroup: 'Settings',
  }),
])
```

| Option | Meaning |
| --- | --- |
| `userModel` | Required lazy User model import, used when assigning the bootstrap administrator |
| `superAdminRole` | Role that bypasses Shield-generated policies; default `super-admin` |
| `resources` | `'all'` or resource slug array; omitted means all |
| `except` | Resource slugs not given a generated policy |
| `navigationGroup` | Roles navigation group; default `Settings` |

Explicit resource `.policy(...)` definitions are never replaced. Policies discovered through `config.pupitre.policies` are not visible to the plugin's resource-extension hook: use explicit `.policy(...)` or `except` to preserve those policies. Excluding a resource does **not** deny it; it leaves authorization to the host. The Roles resource is always selected for protection, even when excluded from `resources` or listed in `except`.

Super administrators bypass Shield policies, not your explicit host policies. Roles and permission grants are global across panels, guards and tenants. Equal resource slugs share permission names; Roles is not tenant-scoped.

## Permission names and synchronization

Permissions use `<slug>.<ability>`, such as `posts.viewAny` and `posts.update`. Each standard ability has its own permission: `viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`, `replicate`, `reorder`, `attach`, `detach`, `associate`, `dissociate`. Custom `.can('publish')` declarations in resource definitions add `posts.publish`. Nested resources are included.

Relation-manager custom `.can()` abilities join the related resource's permission group and use the same super-admin bypass. The Roles form lists only resources whose policies Shield actually enforces: opt-outs and explicit host-policy resources are not included. Reusing a plugin instance across panels keeps each panel's form inventory separate.

```sh
node ace shield:sync
node ace shield:sync --user=admin@example.com
node ace shield:sync --user=1
```

The command boots your panels, creates missing resource permissions and each Shield panel's configured super-admin role, and optionally attaches that role to an existing user identified by ID or email. It is idempotent and retains obsolete permission rows rather than silently revoking grants. Run it after changing resource abilities. Grants are cached per request/user; role edits take effect on the next request.

For programmatic synchronization, import `syncPermissions` from `@rikology/pupitre-shield` and call `await syncPermissions(panels, options?, userIdentity?)`. Supplying Shield options creates the configured super-admin role; supplying an ID/email as the third argument attaches it to that user. Direct host-managed pivot changes must call `invalidateShieldPermissions()` to invalidate request grant caches.

## Roles UI and user assignment

The Roles resource provides list/create/edit pages, grouped resource-permission checkboxes and delete actions. It preserves permissions managed outside that resource-derived form. Non-super-admin editors may **grant or revoke only permissions they possess**; unchanged stronger grants do not prevent a rename, and host-managed external permissions remain intact. Non-super-admins cannot create a role named as the configured super-admin role, rename a role to it, or modify, rename or delete the existing super-admin role, even with `roles.update` or `roles.delete`. Super-admin bypass applies only to Shield-generated policies, not explicit host policies.

Add a `roles` relation inside your existing User model:

```ts
import { manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { Role } from '@rikology/pupitre-shield'

// Inside class User:
@manyToMany(() => Role, {
  pivotTable: 'pupitre_role_user',
  pivotForeignKey: 'user_id',
  pivotRelatedForeignKey: 'role_id',
})
declare roles: ManyToMany<typeof Role>
```

Then add the relationship field to the User resource:

```ts
import { shieldRolesField } from '@rikology/pupitre-shield'

resource.form((s) => [s.email('email').required(), shieldRolesField()])
```

`shieldRolesField()` returns a preloaded `multiSelect('roles')` bound to the `roles` relationship and role `name`. Shield wraps create/update handlers to persist the pivot transactionally while preserving host handlers and hooks. Non-super-admin actors need `roles.update` and may assign or revoke only roles whose permissions they possess; super-admin assignment/revocation requires an existing super administrator. Authorization reads pivots directly, so it does not require preloading the User relation.

Actors without `roles.viewAny` do not see the field. It does not preload role options or dehydrate submitted role changes while hidden, so unrelated User create/edit pages remain available without granting role-list access. Shield middleware warms grants before rendering, allowing the field's internal grant helper to check server-side visibility synchronously without another database query. For application authorization, use the exported asynchronous `shieldAllows` helper below.

## Custom pages and request checks

```ts
import { definePage } from '@rikology/pupitre'
import { shieldCan } from '@rikology/pupitre-shield'

export const settings = definePage('settings')
  .canAccess(shieldCan('settings.access'))
```

Create `settings.access` using the exported `Permission` model and assign it through a Role's `permissions` relation in your seeder or administrative workflow. Synchronization cannot infer arbitrary custom-page access closures, and the Roles UI only edits resource-derived permissions.

`shieldCan(permission, options?)` returns a request access callback. For other request-scoped checks, use `await shieldAllows(ctx, user, permission, options?)`. Both accept `{ superAdminRole: 'owner' }` when your role differs from the default; helpers do not infer it from the panel plugin options.

Non-super-admin role editors may add or remove only permissions they possess; unchanged grants and host-managed custom-page grants remain intact. Call `invalidateShieldPermissions()` after direct pivot mutations. When checking grants inside an existing transaction, pass its client as the fifth argument to `shieldAllows(ctx, user, permission, options, trx)` so checks use the same database connection and bypass the request cache.
