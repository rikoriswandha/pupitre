# @rikology/create-pupitre-plugin

Scaffold a publishable Pupitre plugin with a working external documentation navigation item, TypeScript builds and a Japa manager integration test. Requires Node 24+.

```bash
npm create @rikology/pupitre-plugin acme-audit
npm create @rikology/pupitre-plugin @acme/pupitre-audit -- --dir ./plugins/audit
create-pupitre-plugin demo --dir ./plugins/demo --force
create-pupitre-plugin star-rating --dir ./plugins/star-rating --with-ui
```

Names must be kebab-case, optionally scoped. An optional `pupitre-` prefix is stripped for the runtime plugin name, and added once for the npm package: `demo` → `pupitre-demo`, `@acme/pupitre-audit` → `@acme/pupitre-audit` with runtime name `audit`. The factory uses camelCase (`acme-audit` → `acmeAudit`); JavaScript reserved words receive a `Plugin` suffix (`default` → `defaultPlugin`). Without `--dir`, files go into `./pupitre-<runtime-name>`.

Non-empty targets are refused by default. `--force` overwrites only template files and preserves unrelated files. The template ships package/TypeScript/tsdown configs, a plugin factory, Japa tests/runner, README, CHANGELOG and .gitignore.

## UI plugins

Pass `--with-ui` (or `withUi: true` to `createPlugin`) to generate a complete custom rating field instead of the navigation-only example. Without the flag, generated files remain unchanged.

With UI enabled, factory names colliding with the template's own imports (`defineField`, `definePlugin`, or `vine`) receive a `Plugin` suffix, for example `define-field` → `defineFieldPlugin`. The CLI prints the resolved factory name. Generated tests alias the plugin factory, so package names such as `app` and `test` also remain valid. Field factories, catalog exports, kinds and React component names derive from the plugin name: `star-rating` exports `starRatingField`, `starRatingCatalog` and `StarRatingInput`.

Derived field factories also avoid those imports: `define` exports `definePluginField` rather than colliding with the imported `defineField`. The generated README and tests use the resolved export name.

The UI template includes:

- `catalog.ts`: a `defineCatalogExtension` with the field's Zod props schema.
- `index.ts`: a plugin registering the catalog and a plugin-specific field factory using `defineField`. `.stars(count)` returns a props patch and configures server-side Vine validation.
- `react.tsx`: an accessible numeric rating input using `useBoundValue` and `useFieldError`, with associated label, help and errors, plus required/disabled/read-only behavior.
- Public `.`, `./catalog`, and `./react` exports, matching tsdown entries and declaration output.
- React, renderer, Vine and Zod peer/development dependencies and generated Japa manager/validation tests. UI templates require Pupitre and pupitre-react 1.1+ (the first catalog-extension release) and Zod 4.

For `star-rating`, register `starRating()` on your server panel, use `starRatingField('score').label(t('Rating')).stars(7).required()` in your form, and register its catalog and React component map using `defineRegistry(components, { extensions: [starRatingCatalog] })`. The generated README includes both server and client integration examples. Keep server imports at the package root and browser imports under `/catalog` and `/react`.

## Programmatic API

```ts
import { createPlugin } from '@rikology/create-pupitre-plugin'

const files = await createPlugin({ name: '@acme/audit', directory: './plugins/audit', force: false })

// Include a shared catalog, custom field factory and React component:
await createPlugin({ name: 'star-rating', directory: './plugins/star-rating', withUi: true })
```

Returns absolute paths of written files. Install the generated package's dependencies, run `npm test`, and build with `npm run build`. Import its factory into your host panel and add the result to `.plugins([...])`.

For a local module, use `node ace make:plugin acme-audit`. Add `--package --dir ./plugins/audit` to execute the versioned standalone scaffolder through npx. Generated tests and TypeScript configuration resolve published build exports without the monorepo-only `@rikology/source` condition.
