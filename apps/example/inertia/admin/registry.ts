import { mediaCatalog } from '@rikology/pupitre-media/catalog'
import { defineRegistry } from '@rikology/pupitre-react'
import { components } from '@rikology/pupitre-ui'
import { MarginPreview } from './views/margin_preview.js'
import { StoreTipsWidget } from './views/store_tips_widget.js'
import { ratingCatalog } from '../../admin/rating_catalog.js'
import { StarRating, StarRatingColumn, StarRatingEntry } from './extensions/StarRating.js'

/** Non-catalog names (here `StoreTipsWidget`) become host shell/widget components. */
export const registry = defineRegistry(
  { ...components, StoreTipsWidget, StarRating, StarRatingColumn, StarRatingEntry },
  { extensions: [ratingCatalog, mediaCatalog] }
)

/** Components available to `schema.view(name, props)`. */
export const views = { MarginPreview }
