---
title: "Writing plugins"
description: "Build server-side Pupitre plugins that contribute resources, pages, widgets and adapters to a host panel."
---

Plugins are ordinary server-side definitions. Export an options factory returning `definePlugin()` and add its result to a panel's `.plugins([...])` list.

Official integrations demonstrate the boundaries: [Shield](/plugins/shield/) contributes roles and policies, [Audit](/plugins/audit/) contributes a read-only resource and timeline specs, [Media](/plugins/media/), [Jobs](/plugins/jobs/) and [Backup](/plugins/backup/) contribute resources over their own tables, [Calendar](/plugins/calendar/), [Kanban](/plugins/kanban/) and [Health](/plugins/health/) contribute pages and widgets rendered by components that ship in `@rikology/pupitre-ui`, and [Transmit](/plugins/transmit/) supplies server/browser realtime adapters rather than a panel `.plugins()` entry. Official plugins stay server-only: their React surfaces live in the default UI package so hosts can own them through the registry.

```ts
import { definePlugin, nav } from '@rikology/pupitre'

export function teamTools(options: { docsUrl: string }) {
  return definePlugin({
    name: 'team-tools',
    register(panel) {
      return panel.breadcrumbs(true)
    },
    navigation: [nav.group('Team tools').items([
      nav.item('Team handbook').url(options.docsUrl).external(),
    ])],
  })
}

// definePanel('admin').plugins([teamTools({ docsUrl: 'https://example.com/handbook' })])
```

Names must be unique kebab-case within a panel. `definePlugin` validates names, unknown keys and hook types. Panel builders are immutable: `register(panel) { panel.theme(...) }` without returning the new builder does not apply that change.

## Contract and order

1. Each plugin runs `register(panel)` in declaration order. Return a new `PanelBuilder` or nothing. A plugin cannot change panel ID or register another plugin list.
2. After its register hook, its resources/pages/widgets append to the current panel entries. Middleware appends after existing middleware. Navigation appends to explicit navigation, or is saved as plugin navigation for derived mode.
3. Once all register hooks and contributions are applied, `extendResource(resource, { panel, parent? })` runs in order for every resource, including nested resources. Return a new definition or nothing. Slug and model identity cannot change; `parent` is the parent resource slug when nested.
4. `boot({ app, manager, panel })` runs once per resolved panel in order, after all panels resolve and jobs initialize, before routes are registered. Boot may be async.

Hooks are optional; `register` and `extendResource` are synchronous. Contributions accept arrays or records for resources/pages/widgets; navigation accepts definitions or builders. See the [exact plugin types](/reference/api-plugin/).

## Catalog contributions

A plugin can declare `catalog: [ratingCatalog]`, where each item is a Zod-only `CatalogExtension` created with `defineCatalogExtension` from `@rikology/pupitre/catalog`. The panel exposes extension names and component names as metadata. It does not send server validation callbacks or install React components automatically.

```ts
import { definePlugin } from '@rikology/pupitre'
import { ratingCatalog } from '../../../admin/rating_catalog.js'

export const ratingPlugin = definePlugin({
  name: 'star-rating',
  catalog: [ratingCatalog],
})
```

The browser must also call `defineRegistry({ ...components, StarRating, StarRatingColumn, StarRatingEntry }, { extensions: [ratingCatalog] })`. Keep the shared catalog free of server and React imports, and export server builders separately using `defineField`, `defineColumn` and `defineEntry`. Component names cannot collide with built-ins or another registered extension. See [Custom fields, columns and entries](/guides/custom-components/) for typed methods, Vine validation, accessibility and the working Comments example.

## Navigation merge rules

Equal group labels merge host and plugin items. In explicit mode, plugin entries append to the host tree. In derived mode, plugin entries follow derived groups, and resources/pages claimed by plugin navigation are not derived a second time. Declaration order matters when several plugins change the same resource field. Avoid duplicate slugs and use clear group labels rather than relying on accidental sorting.

## Generate a local plugin

```sh
node ace make:plugin TeamTools
```

This generates `app/admin/plugins/team_tools_plugin.ts`, preserving an existing file unless `--force` is supplied. Import it and register it on the panel; plugins are not auto-attached merely because their file exists. The generated plugin contributes a working documentation navigation link.

## Generate a publishable package

```sh
npm create @rikology/pupitre-plugin team-tools
# Pass scaffold flags after npm's separator:
npm create @rikology/pupitre-plugin team-tools -- --dir=packages/team-tools
```

From an existing Pupitre application, you can also run:

```sh
node ace make:plugin team-tools --package --dir packages/team-tools
```

This executes `npx --yes @rikology/create-pupitre-plugin@<major> team-tools --dir packages/team-tools`, using the installed Pupitre major version. The Ace wrapper waits for completion and reports failures; it does not generate a local definition in package mode. Its default `--dir` is the normalized plugin name (`team-tools` here), unlike the standalone initializer's default below. Ace's `--force` is only for local definitions; use the standalone initializer directly when you need its `--force`.

The initializer package is `@rikology/create-pupitre-plugin`; npm's `create @rikology/pupitre-plugin` resolves it. Its installed binary is `create-pupitre-plugin`, which accepts the same `<name> --dir <path> --force` arguments. Requires Node 24+. The generated factory uses camelCase (`team-tools` → `teamTools`); reserved JavaScript names get a `Plugin` suffix. `--force` only replaces template files and preserves unrelated files.

Names can be kebab-case, optionally `pupitre-` prefixed or npm-scoped. Default directory is `pupitre-<name>`; package name is `pupitre-<name>` with the optional scope retained. `--dir` overrides the directory, `--force` overwrites template files in a nonempty directory, and `--help` prints usage. No dependency installation is performed by the generator.

The template includes an options factory, real navigation contribution, TypeScript package/build config, Japa tests, README and changelog. Install dependencies and run its tests before publishing; list host integrations as peers and load optional peers only when needed. Core plugins contribute definitions/specs, not React imports. Additional visual components belong in the host registry.

Generated package exports use standard `types` and `default` entries pointing at compiled output; they do not use the monorepo-only `@rikology/source` condition. Build the package before importing it from a host or publishing it.
