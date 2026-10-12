import { defineWidget, table } from '@rikology/pupitre'
import type User from '#models/user'
import Product from '#models/product'

/** Table widget: shares the resource table compiler (sort, paginate, format). */
export default defineWidget('store-low-stock', Product)
  .heading('Restock queue')
  .description('Visible to administrators only.')
  .span(2)
  .sort(6)
  .canView((ctx) => (ctx.auth.user as User | undefined)?.email === 'admin@example.com')
  .table((t) =>
    t
      .query((query) => {
        query.where('stock', '<', 10).whereNot('status', 'archived')
      })
      .columns([
        table.text('name').label('Product').sortable(),
        table.text('sku').label('SKU'),
        table.text('stock').label('Stock').numeric().sortable(),
        table
          .badge('status')
          .options({ draft: 'Draft', active: 'Active' })
          .colors({ draft: 'gray', active: 'success' }),
      ])
      .defaultSort('stock', 'asc')
      .paginated([5, 10])
      .emptyState({ heading: 'Nothing to restock', icon: 'check' })
  )
