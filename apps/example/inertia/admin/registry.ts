import { defineRegistry } from '@rikology/pupitre-react'
import { components } from '@rikology/pupitre-ui'
import { MarginPreview } from './views/margin_preview.js'
import { StoreTipsWidget } from './views/store_tips_widget.js'

/** Non-catalog names (here `StoreTipsWidget`) become host shell/widget components. */
export const registry = defineRegistry({ ...components, StoreTipsWidget })

/** Components available to `schema.view(name, props)`. */
export const views = { MarginPreview }
