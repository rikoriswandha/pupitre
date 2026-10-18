---
title: "Tenancy"
description: "Configure URL or implicit tenant selection, membership checks and query scoping for resources and related operations."
---

Panel tenancy supports URL and implicit modes. URL mode places the tenant identifier below the panel path; implicit mode uses the authenticated user's current tenant attribute. Both resolve membership before a resource query can run.

```ts
.tenancy({
  mode: 'url',
  model: () => import('#models/team'),
  ownership: 'team_id',
  slugAttribute: 'slug',
  titleAttribute: 'name',
  tenantsForUser: async (user) => user.related('teams').query(),
})
```

The default column driver requires both `model` and `tenantsForUser`. Defaults: ownership `tenant_id`, slug `slug`, display title `name`, switcher menu enabled, current tenant attribute `currentTenantId`. Configure the actual ownership column and corresponding Lucid attributes in your models/migrations. Use `.tenancy(false)` to disable the feature.

## Scoping and membership

The driver resolves a tenant, lists only memberships, restricts resource queries and fills create ownership. URL mode opens a selected tenant URL; implicit mode persists the current tenant using the configured user attribute. Merely finding a tenant by slug is not enough: membership must be verified.

The same tenant boundary applies to search, options, actions, parent/nested resources and queued jobs. Use `.scope(false)` only for intentional global resources; policies still apply. Custom widget loaders and unrelated queries in your application must implement their own tenant restrictions.

## Custom adapter

Implement `TenancyAdapter`: `resolve(ctx)`, `scope(query, tenant, options)`, `fill(data, tenant, options)`, `listForUser(ctx)`, optionally `switch(ctx, tenantId)` and `run(tenant, next)`. Pass an adapter or a lazy async adapter factory in `.tenancy({ mode, adapter })`. Returning null from resolve means missing tenant or missing membership. See the exact [tenancy contract](/reference/api-configuration/).

`createTenantDriver(definition)` from `@rikology/pupitre/drivers/tenant` integrates `@rikology/adonisjs-tenant`; it still requires a model and membership callback. Tenant billing and a generic tenant-registration workflow are not core features; build host workflows as custom pages/resources with the same authorization boundary.
