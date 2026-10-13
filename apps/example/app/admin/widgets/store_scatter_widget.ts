import { authorizeResource, defineWidget, scopedQuery } from '@rikology/pupitre'
import Product from '#models/product'

export default defineWidget('store-scatter')
  .heading('Price and stock')
  .sort(5)
  .canView(async (ctx) => {
    const resource = ctx.pupitre.panel.resources.find((item) => item.model === Product)
    return Boolean(resource && (await authorizeResource(ctx, resource, 'viewAny')))
  })
  .chart('scatter', async ({ ctx }) => {
    const resource = ctx.pupitre.panel.resources.find((item) => item.model === Product)!
    const products = (await scopedQuery(ctx, resource)) as Product[]
    return {
      datasets: [
        {
          label: 'Products',
          data: products.map((product) => ({ x: Number(product.price), y: Number(product.stock) })),
        },
      ],
    }
  })
