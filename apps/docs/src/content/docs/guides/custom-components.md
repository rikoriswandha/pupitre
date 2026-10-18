---
title: "Custom fields, columns and entries"
description: "Extend the catalog with typed server builders, validation and accessible host components for fields, columns and entries."
sidebar:
  label: "Custom components"
---

A catalog extension adds a new form field, table column or infolist entry. Unlike replacing a built-in component, it gives your component its own props schema, builder methods and server validation. The example application's Comments resource demonstrates all three, including an action modal and a nested repeater.

## 1. Share a Zod-only catalog
Install Zod 4 as a direct dependency of the host; do not rely on Pupitre's transitive dependency:

```bash
npm install zod@^4.3.6
```


Put this module somewhere both server and browser can import. Do not import React, Vine, Lucid or server builders here.

```ts
// admin/rating_catalog.ts
import { defineCatalogExtension } from '@rikology/pupitre/catalog'
import { z } from 'zod'

const props = z.object({
  max: z.number().int().min(1).max(10).optional().default(5),
})

export const ratingCatalog = defineCatalogExtension({
  name: 'star-rating',
  components: {
    StarRating: { kind: 'field', props, description: 'A star rating input.' },
    StarRatingColumn: { kind: 'column', props, description: 'A star rating table cell.' },
    StarRatingEntry: { kind: 'entry', props, description: 'A star rating entry.' },
  },
})
```

Declare only your custom configuration. Pupitre merges the common props and expression/binding schemas for the component's kind. `CatalogExtension` is the public type; `mergeCatalogExtensions(extensions)` returns the same shape as `pupitreCatalog`, stripping `kind` from json-render definitions.

Built-in component names cannot be replaced by an extension. Component names must also be unique across extensions registered together. Replacing an existing UI component belongs in the ordinary registry component map, not a new catalog definition.

## 2. Define server factories

```ts
// app/admin/extensions/rating.ts
import { defineField, defineColumn, defineEntry } from '@rikology/pupitre'
import vine from '@vinejs/vine'
import { ratingCatalog } from '../../../admin/rating_catalog.js'

const methods = { stars: (max: number) => ({ max }) }

export const rating = defineField('rating', {
  extension: ratingCatalog,
  component: 'StarRating',
  methods,
  validate: (props) => vine.number().withoutDecimals().min(0).max(props.max ?? 5),
})
export const ratingColumn = defineColumn('rating', {
  extension: ratingCatalog, component: 'StarRatingColumn', methods,
})
export const ratingEntry = defineEntry('rating', {
  extension: ratingCatalog, component: 'StarRatingEntry', methods,
})
```

Use the returned factories directly: `rating('rating').label(t('Rating')).stars(5).required()`, `ratingColumn('rating')`, and `ratingEntry('rating')`. There is no `schema.rating` namespace registration. Custom methods return a props patch and retain typed arguments; they do not mutate a builder. Existing base methods remain available. Invalid patches fail immediately, and complete props are parsed when the definition is compiled.

Definitions retain the schema's input props. Compilers parse them into output props for rendering and `validate(props)`, so Zod transforms and preprocessors are supported without parsing their output a second time.

The field's `validate(props)` returns a Vine schema, not a compiled validator. It runs on resource submissions, modal action submissions and nested repeater rows. Optional field `dehydrate` transforms saved data; column/entry `format(value, record)` transforms display values. The server owns validation and authorization, regardless of what the browser submits.

## 3. Register both sides

Contribute the catalog through a server plugin:

```ts
import { definePlugin } from '@rikology/pupitre'
import { ratingCatalog } from '../../../admin/rating_catalog.js'

export const ratingPlugin = definePlugin({
  name: 'star-rating',
  catalog: [ratingCatalog],
})
// Add ratingPlugin to your panel's .plugins([...]).
```

Then install your actual React implementations in the host registry:

```ts
import { defineRegistry } from '@rikology/pupitre-react'
import { components } from '@rikology/pupitre-ui'
import { ratingCatalog } from '../../admin/rating_catalog.js'
import { StarRating, StarRatingColumn, StarRatingEntry } from './extensions/StarRating.js'

export const registry = defineRegistry(
  { ...components, StarRating, StarRatingColumn, StarRatingEntry },
  { extensions: [ratingCatalog] },
)
```

The plugin exposes extension metadata on the panel. It does not ship React code to the client: the host registry must include the same extension and all three implementations. Custom kinds are scoped by extension name and category; two independent extensions may use the same kind. Duplicate kinds within one extension/category and conflicting component names in a panel/registry are rejected rather than silently overwritten.

Pages and JSON action-form responses declare the extension components actually emitted by their specs (including nested repeaters, infolists and table descriptors). The renderer checks these requirements before entering json-render's element error boundaries, so a missing implementation fails loudly instead of hiding a field or table.

Version extension components with the host/plugin package: optional props are minor changes; changing/removing props or component names is a major change. `catalogVersion` protects the core protocol, not plugin versions, so deploy the extension's server builders, shared catalog and client registry together.

## 4. Bind an accessible field

Registry components receive `{ props, bindings }`. Read and update a field through `useBoundValue(props.value ?? 0, bindings?.value)`, and resolve its validation error with `useFieldError(props.error, bindings?.value)`, both from `@rikology/pupitre-react`. Do not manually construct `/data` paths: bindings already account for repeater rows and the action modal's separate store.

The example uses native radio inputs with a fieldset and legend. The browser provides arrow-key selection and Space without custom keyboard handlers. The selected score has a visible filled-star shape, not just a color change, and each target is 32px. Error/help text is linked by `aria-describedby`; controls have visible focus and disabled states. Theme colors use Pupitre tokens and components reuse `Field`, `FieldDescription`, `FieldError`, `Icon` and `RequiredMark` from the public UI package. All visible and accessibility copy uses client `t()`.

Column and entry implementations receive the same custom `max` alongside the row/record value. Their read-only star display exposes a translated textual accessible name such as `t('{count} of {max} stars', { count, max })`.

## 5. Use it everywhere

```ts
import { schema, t } from '@rikology/pupitre'
import { rating, ratingColumn, ratingEntry } from '../extensions/rating.js'

// Resource .form(...) or action .form(...):
const fields = [rating('rating').label(t('Rating')).stars(5).default(0)]
// Table .columns(...):
const columns = [ratingColumn('rating').label(t('Rating')).stars(5).sortable()]
// Resource .infolist(...):
const entries = [ratingEntry('rating').label(t('Rating')).stars(5)]
// Nested fields retain their own binding and validation:
const criteria = schema.repeater('ratingDetails').label(t('Rating criteria')).schema([
  schema.text('criterion').label(t('Criterion')).required(),
  rating('score').label(t('Criterion rating')).stars(5).required(),
])
```

See `apps/example/admin/rating_catalog.ts`, `app/admin/extensions/rating.ts`, `inertia/admin/extensions/StarRating.tsx`, and `app/admin/resources/comment_resource.ts` for the working implementation. The targeted `e2e/43_catalog_extension.spec.ts` covers keyboard selection, minimum target size, persisted nested state, table/view rendering, action updates and rejection of a forged out-of-range score.
