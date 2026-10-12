import { defineCatalogExtension } from '@rikology/pupitre/catalog'
import { z } from 'zod'

const ratingProps = z.object({
  max: z.number().int().min(1).max(10).optional().default(5),
})

/** Shared by the server and browser; no Vine, Lucid or React dependencies. */
export const ratingCatalog = defineCatalogExtension({
  name: 'star-rating',
  components: {
    StarRating: {
      kind: 'field',
      props: ratingProps,
      description: 'An accessible star rating input.',
    },
    StarRatingColumn: {
      kind: 'column',
      props: ratingProps,
      description: 'A star rating table cell.',
    },
    StarRatingEntry: {
      kind: 'entry',
      props: ratingProps,
      description: 'A read-only star rating entry.',
    },
  },
})

export type RatingProps = z.infer<typeof ratingProps> & {
  name?: string
  label?: string | null
  value?: unknown
  helperText?: string | null
  error?: string | null
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  columnSpan?: number | 'full'
}
