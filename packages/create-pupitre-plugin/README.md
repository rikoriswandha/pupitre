# @rikology/create-pupitre-plugin

Scaffold a publishable Pupitre plugin with a working external documentation navigation item, TypeScript builds and a Japa manager integration test. Requires Node 24+.

```bash
npm create @rikology/pupitre-plugin acme-audit
npm create @rikology/pupitre-plugin @acme/pupitre-audit -- --dir ./plugins/audit
create-pupitre-plugin demo --dir ./plugins/demo --force
```

Names must be kebab-case, optionally scoped. An optional `pupitre-` prefix is stripped for the runtime plugin name, and added once for the npm package: `demo` → `pupitre-demo`, `@acme/pupitre-audit` → `@acme/pupitre-audit` with runtime name `audit`. The factory uses camelCase (`acme-audit` → `acmeAudit`); JavaScript reserved words receive a `Plugin` suffix (`default` → `defaultPlugin`). Without `--dir`, files go into `./pupitre-<runtime-name>`.

Non-empty targets are refused by default. `--force` overwrites only template files and preserves unrelated files. The template ships package/TypeScript/tsdown configs, a plugin factory, Japa tests/runner, README, CHANGELOG and .gitignore.

## Programmatic API

```ts
import { createPlugin } from '@rikology/create-pupitre-plugin'

const files = await createPlugin({ name: '@acme/audit', directory: './plugins/audit', force: false })
```

Returns absolute paths of written files. Install the generated package's dependencies, run `npm test`, and build with `npm run build`. Import its factory into your host panel and add the result to `.plugins([...])`.

For a local module, use `node ace make:plugin acme-audit`. Add `--package --dir ./plugins/audit` to execute the versioned standalone scaffolder through npx. Generated tests and TypeScript configuration resolve published build exports without the monorepo-only `@rikology/source` condition.
