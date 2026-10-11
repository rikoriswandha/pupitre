# @rikology/pupitre-shield

Database-backed roles and permissions for Pupitre. Shield contributes a global Roles resource with grouped permission checkboxes and a Bouncer policy for resources without an explicit policy.

## Install

```sh
node ace add @rikology/pupitre-shield
# Already installed:
node ace configure @rikology/pupitre-shield
node ace migration:run
```

Configure publishes `1791700000037_create_pupitre_shield_tables.ts` without overwriting an existing migration and registers `@rikology/pupitre-shield/commands` in `adonisrc.ts`. No extra provider is needed: the plugin boots with Pupitre. For a different host users table, pass `--user-table=accounts` during configure. The migration defaults to integer `users.id`; adapt its `user_id` column and reference for UUID/custom primary keys before migrating.

```ts
import { shield } from '@rikology/pupitre-shield'

panel.plugins([
  shield({
    userModel: () => import('#models/user'),
    superAdminRole: 'super-admin',
    resources: 'all', // or selected resource slugs
    except: ['billing'],
    navigationGroup: 'Administration',
  }),
])
```

Explicit `.policy()` resources are never replaced. Policies discovered via `config.pupitre.policies` are not visible to `extendResource`: declare `.policy()` explicitly or use `except` to preserve them. The example opts into only `roles`, preserving all existing editorial policies and relation behavior. Roles is always protected by Shield and is not tenant-scoped. Roles and permissions are global across panels and guards; permission names sharing a slug share grants.

Permission names are `<slug>.<ability>`. Standard abilities: `viewAny`, `view`, `create`, `update`, `delete`, `restore`, `forceDelete`, `replicate`, `reorder`, `attach`, `detach`, `associate`, `dissociate`; resource custom action `.can('publish')` adds `<slug>.publish`. Nested resources are included. Generated policies define every standard ability independently rather than relying on core fallback mappings. Role and permission grants are loaded in one joined query per request/user, shared across policies and page checks; edits take effect on the next request. Super administrators bypass every Shield policy, not a host's explicit policy.

The Roles form lists only resources actually protected by Shield, excluding opt-outs and explicit host policies. Relation-manager custom `.can()` abilities belong to the related resource's permission group and support the same super-admin bypass. A single plugin instance may be reused across panels without mixing their inventories.

## Synchronize permissions and bootstrap an administrator

```sh
node ace shield:sync
node ace shield:sync --user=admin@example.com
node ace shield:sync --user=1
```

The command boots configured Pupitre panels, idempotently creates missing resource permissions and the configured super-admin role for each Shield panel, and optionally attaches that role to a user identified by ID or email. Existing permissions are retained so removing a resource does not silently revoke stored grants. `syncPermissions(panels, options?, userIdentity?)` exposes the same operation programmatically.

## Assign roles through the host User resource

Add the following relation to your User model (the host keeps its existing base class and auth mixins):

```ts
import { manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { Role } from '@rikology/pupitre-shield'

@manyToMany(() => Role, {
  pivotTable: 'pupitre_role_user',
  pivotForeignKey: 'user_id',
  pivotRelatedForeignKey: 'role_id',
})
declare roles: ManyToMany<typeof Role>
```

Then include `shieldRolesField()` in the User resource form. It returns a preloaded multi-select bound to the `roles` relation. The Shield plugin wraps the resource's create/update handlers to persist the pivot in the same transaction, preserving existing handlers and hooks. Non-super-admin managers need `roles.update` and may assign or revoke only roles whose permissions they possess; only super administrators can assign or revoke the super-admin role. Authorization reads pivots directly and does not require preloading the User relation.

The helper hides role assignments when the actor lacks `roles.viewAny`; unrelated User create/edit pages remain accessible and hidden fields do not preload role options or dehydrate submitted role changes. Middleware warms grants once per authenticated request so visibility checks remain synchronous and server-side.

```ts
import { shieldRolesField } from '@rikology/pupitre-shield'

resource.form((s) => [s.email('email').required(), shieldRolesField()])
```

## Custom pages

```ts
import { shieldCan, Permission } from '@rikology/pupitre-shield'

await Permission.firstOrCreate({ name: 'settings.access' })
const settings = definePage('settings').canAccess(shieldCan('settings.access'))
```

Create/assign custom-page permissions explicitly; resource synchronization cannot infer arbitrary `canAccess` closures. Pass `{ superAdminRole: 'owner' }` as the helper's second argument when using a non-default super-admin role. `shieldAllows(ctx, user, permission, options?)` is available for other request-scoped authorization checks. The role editor exposes resource-derived permissions; manage custom-page grants via `Role.related('permissions')`.

Non-super-admin role editors may add or remove only permissions they possess; unchanged grants and host-managed custom-page permissions are preserved. Call `invalidateShieldPermissions()` after direct host-managed role/permission pivot changes. Inside an existing transaction, pass its client as the fifth argument to `shieldAllows(ctx, user, permission, options, trx)`; transactional reads bypass the request cache and do not acquire another SQLite connection.

## Public models

`Role` uses `pupitre_roles` and exposes `permissions: ManyToMany<Permission>`. `Permission` uses `pupitre_permissions`. Pivots have composite primary keys and cascade deletes. Both models create/update UTC timestamps automatically.
