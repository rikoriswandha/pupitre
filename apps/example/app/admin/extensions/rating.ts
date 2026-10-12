import { defineColumn, defineEntry, defineField, definePlugin } from '@rikology/pupitre'
import vine from '@vinejs/vine'
import { ratingCatalog } from '../../../admin/rating_catalog.js'

const methods = { stars: (max: number) => ({ max }) }

export const rating = defineField('rating', {
  extension: ratingCatalog,
  component: 'StarRating',
  methods,
  validate: (props) =>
    vine
      .number()
      .withoutDecimals()
      .min(0)
      .max(props.max ?? 5),
})

export const ratingColumn = defineColumn('rating', {
  extension: ratingCatalog,
  component: 'StarRatingColumn',
  methods,
})

export const ratingEntry = defineEntry('rating', {
  extension: ratingCatalog,
  component: 'StarRatingEntry',
  methods,
})

export const ratingPlugin = definePlugin({ name: 'star-rating', catalog: [ratingCatalog] })
