# @rikology/pupitre-kanban

Server-only Kanban boards for Pupitre resource definitions. Register `kanban(Resource, options)` in your panel's `.plugins([...])`. The default Pupitre UI component map includes the lazy `KanbanBoard`; copied registries must include it too.

```ts
import { kanban } from '@rikology/pupitre-kanban'

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
  page: { slug: 'orders-board', label: 'Orders board', navigationGroup: 'Sales' },
}).canMove((record, from, to, ctx) => to !== 'paid' || Boolean(ctx.auth.user))
```

Column/title/description/entry names are Lucid attributes. Supply a numeric order attribute if persistent intra-column ordering is needed; positions are zero-based and rewritten atomically in the source and target columns. Without it, moves persist status and cards display in primary-key order. SQLite transactions and PostgreSQL row locks protect writes; PostgreSQL locks all scoped declared columns in primary-key order to avoid opposite-direction lock inversion.

The resource must be registered in the same panel and must not be nested. Board reads require `viewAny` and always apply resource/tenant scope. Moves reload through that scope, then require record `update`; `canMove` adds a business rule without replacing authorization. Card links require `view` or `update` and an available resource page. Create links require `create`, open the resource create page, and prefill the declared status. Use `t()` on configured labels when localizing the host application.

`limitPerColumn` loads an independent initial slice; Load more extends the selected column by 25 cards. Without a limit, the full columns load. Counts always reflect the full scoped column. Pointer and keyboard dragging announce their lifecycle to screen readers. Failed moves restore the previous board and display an error toast. Heavy drag-and-drop code is lazy-loaded.

No extra database tables or configure hook are required. Add and migrate your resource's order column yourself when opting into ordering.
