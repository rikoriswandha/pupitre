import { defineWidget, stat } from '@rikology/pupitre'
import Product from '#models/product'

/** Record-aware stats placed in the product edit page header. */
export default defineWidget('product-inventory')
  .heading('Inventory snapshot')
  .stats(async ({ record }) => {
    if (!(record instanceof Product)) return []
    const variants = await record.related('variants').query().count('* as total')
    const margin = record.cost === null ? null : record.price - record.cost
    return [
      stat('On hand', record.stock)
        .description(record.stock < 10 ? 'Below reorder point' : 'Healthy stock')
        .descriptionIcon(record.stock < 10 ? 'trending-down' : 'trending-up')
        .color(record.stock === 0 ? 'danger' : record.stock < 10 ? 'warning' : 'success'),
      stat('Margin per unit', margin === null ? '—' : `Rp ${margin.toLocaleString('id-ID')}`)
        .description(margin === null ? 'Set a cost to see margin' : 'Price minus cost')
        .color('primary'),
      stat('Variants', Number(variants[0]?.$extras.total ?? 0)),
    ]
  })
