---
title: Kanban boards
description: Scoped resource boards with authorized, persistent status moves.
---

The server-only `@rikology/pupitre-kanban` plugin contributes a board page. The default Pupitre UI registry includes a lazy `KanbanBoard`; custom copied registries must register that component.

```ts
import { kanban } from '@rikology/pupitre-kanban'

panel.plugins([
  kanban(OrderResource, {
    statusColumn: 'status',
    statuses: [
      { value: 'pending', label: 'Pending' },
      { value: 'paid', label: 'Paid', color: '#167a72' },
    ],
    title: 'number',
    description: 'customerName',
    orderColumn: 'position',
    cardEntries: [{ name: 'customerEmail', label: 'Email' }],
    limitPerColumn: 25,
    page: { slug: 'orders-board', label: 'Orders board', icon: 'columns-3', navigationGroup: 'Sales' },
  }).canMove((record, from, to, ctx) => to !== 'paid' || Boolean(ctx.auth.user)),
])
```

Register the resource in the same panel. Attribute names refer to the Lucid model; the optional numeric order attribute belongs to your resource migration. Nested resources are not supported because a board has no parent-record route context. No plugin tables or configure hook are needed.

## Authorization and transactions

Loading requires resource `viewAny` and applies its scope and tenant boundary. Every move looks up the record again through that scope and requires `update`; records outside scope return 404. Only declared statuses are accepted. `canMove` is an additional immutable business-rule gate, not a replacement for your resource policy.

With `orderColumn`, insertion rewrites zero-based positions in both affected columns in one transaction. PostgreSQL locks scoped declared columns in deterministic primary-key order; SQLite uses its transaction writer serialization. Without an order attribute, moves persist status and display primary-key order.

Links are emitted only when the card can be viewed or edited. Create-in-column links require `create` and open the resource's create page with the status prefilled. Labels can be supplied through server `t()` for bilingual applications.

## Interaction

Drag a card using its handle, or focus the handle and press Space, use arrow keys, then Space again to drop; Escape cancels. Screen-reader announcements describe the drag lifecycle. Failed mutations roll back the optimistic board and show a toast. Columns scroll horizontally on small screens and support light/dark theme tokens.

`limitPerColumn` applies independently to each status. Counts cover the whole scoped column; Load more expands a column by 25 cards. Without a limit, the full columns load. The example app exposes `/admin/acme/orders-board`.
