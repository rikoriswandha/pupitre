import { authorizeResource, defineWidget, scopedQuery } from '@rikology/pupitre'
import Product from '#models/product'

export default defineWidget('store-radar')
  .heading('Inventory profile')
  .sort(5)
  .canView(async (ctx) => {
    const resource = ctx.pupitre.panel.resources.find((item) => item.model === Product)
    return Boolean(resource && (await authorizeResource(ctx, resource, 'viewAny')))
  })
  .chart('radar', async ({ ctx }) => {
    const resource = ctx.pupitre.panel.resources.find((item) => item.model === Product)!
    const products = (await scopedQuery(ctx, resource)) as Product[]
    return {
      labels: ['Draft', 'Active', 'Archived'],
      datasets: [
        {
          label: 'Products',
          data: ['draft', 'active', 'archived'].map(
            (status) => products.filter((product) => product.status === status).length
          ),
        },
      ],
    }
  })
