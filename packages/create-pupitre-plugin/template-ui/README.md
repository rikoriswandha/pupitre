# {{packageName}}

A Pupitre UI plugin with a shared catalog, a typed rating field factory, server validation, and an accessible bound React input.

## Install and use

```bash
npm install {{packageName}}
```

On the server, register the plugin and use the factory directly in a resource form:

```ts
import { t } from '@rikology/pupitre'
import { {{camelName}}, {{fieldName}} } from '{{packageName}}'

// On your existing definePanel(...) builder:
.plugins([{{camelName}}()])

// Inside your resource's form schema callback:
[{{fieldName}}('score').label(t('Rating')).stars(7).required()]
```

Register the same catalog and component map in the host's React registry:

```tsx
import { defineRegistry } from '@rikology/pupitre-react'
import { {{catalogName}} } from '{{packageName}}/catalog'
import { components as extensionComponents } from '{{packageName}}/react'
import { components as builtInComponents } from '@rikology/pupitre-ui/components'

const registry = defineRegistry(
  { ...builtInComponents, ...extensionComponents },
  { extensions: [{{catalogName}}] }
)
```

Pass this registry to your existing `<Pupitre registry={registry} />` renderer. The server plugin contributes the catalog; it never imports React. The `/catalog` subpath is shared schema metadata, while `/react` contains the browser component.

`{{fieldName}}('score')` accepts integer values from zero through five by default. `.stars(7)` changes the maximum on both server and client. Common field methods such as `.label()`, `.required()`, `.disabled()`, `.readOnly()`, and `.helperText()` remain available. The React input updates Pupitre's bound value, associates its label/help/errors with the input, and honors required, disabled and read-only states. Factory, kind and component names are derived from the plugin name so independently generated UI plugins can coexist.

## Development

Requires Node 24+, Pupitre and pupitre-react 1.1+, and Zod 4. Run `npm install`, `npm test`, then `npm run build`.
The Japa tests boot a real Pupitre manager and exercise server validation, including configured limits, fractional values and missing required values.
The build publishes `.`, `/catalog`, and `/react` entries with TypeScript declarations. Publish with `npm publish --access public`.
