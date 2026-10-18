---
title: "Navigation clusters"
description: "Group related resources and custom pages behind a shared navigation entry without changing their individual policies."
---

Clusters organize related resources and custom pages without adding a landing page or changing their policies.

```ts
import { defineCluster } from '@rikology/pupitre'

export default defineCluster('catalog')
  .label('Catalog')
  .icon('tag')
  .navigationGroup('Content')
  .sort(2)
  .subNavigationPosition('start')
```

Reference the same immutable builder from resources and pages:

```ts
import CatalogCluster from '../clusters/catalog_cluster.js'

export default defineResource(Category).cluster(CatalogCluster)
// Custom pages also support definePage('preferences').cluster(CatalogCluster).
```

Panels discover clusters from registered resources and pages; no separate panel registration is necessary. Two references to the same slug must have identical cluster settings. Slugs must be URL-safe and must not collide with resource/page slugs or built-in routes. Invalid or conflicting definitions fail at boot.

The main navigation replaces the children with one cluster entry pointing to its first accessible child, ordered by child navigation sort then localized label. Resources require `viewAny`; pages use `canAccess`. An empty cluster is hidden. Explicit panel navigation cannot bypass these gates or expose clustered children as separate entries.

Routes become `/admin/catalog/categories`, including create, edit, actions and relation endpoints. URL tenancy places the tenant before the cluster: `/admin/acme/catalog/categories`. Nested resources inherit their parent's cluster and keep the parent record segment. Existing resource URL builders, global search results and notification actions generated from those builders automatically use the clustered URLs. Update any hard-coded host links when adopting a cluster; previously persisted notification URLs are not rewritten.

Every clustered page receives authorized sibling navigation and a cluster breadcrumb. `start` renders a left-side sibling list on desktop and a horizontally scrollable navigation row on mobile. `top` keeps the row above the content on all screen sizes. Native links support Tab/Enter and expose `aria-current="page"`; record navigation remains independent.

Generate a definition with:

```sh
node ace make:cluster Catalog
node ace make:cluster Catalog --force
```

The generator writes `app/admin/clusters/catalog_cluster.ts`, leaves existing files unchanged by default, and overwrites only with `--force`. Import this file directly; the cluster does not need a generated discovery barrel.
