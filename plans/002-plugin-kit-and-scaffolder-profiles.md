# Plan 002: Share fail-closed plugin mechanics and generate package lifecycle profiles

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`, unless the dispatching reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 4e076fa..HEAD -- packages/pupitre packages/pupitre-backup packages/pupitre-jobs packages/pupitre-health packages/pupitre-settings packages/pupitre-audit packages/create-pupitre-plugin tools/verify-exports apps/docs/src/content/docs/plugins.md docs/ARCHITECTURE.md plans/README.md`
> The planning tree already contains extensive uncommitted and untracked plugin, core, UI, example, and documentation work. The command above is NOT a sufficient drift check: compare every Current state excerpt below against the LIVE files, including untracked files, even if that diff is empty. STOP on mismatch. Preserve all pre-existing changes; never reset, clean, or replace the working tree.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx / tech-debt
- **Planned at**: commit `4e076fa`, 2026-10-13

## Why this matters

Five official plugins independently normalize imported policy modules, check policy methods, and discover Bouncer before denying absent authorization. This duplication makes security-preserving maintenance expensive, but their tenant and ability rules are genuinely different and must not be unified. The package scaffolder currently cannot generate configure hooks, commands, or migrations, so authors copy lifecycle plumbing from official plugins. A small server-only kit plus composable, opt-in generator profiles removes that copying and unblocks later plugin work without extending the panel plugin lifecycle.

## Current state

### Authorization: shared mechanics versus deliberately different rules

`packages/pupitre-backup/index.ts:54-59` selects a host policy and unwraps one default export:

```ts
const policies = await config.policies?.()
const candidate = policies?.BackupPolicy
const policy =
  candidate && typeof candidate === 'object' && 'default' in candidate
    ? candidate.default
    : candidate
```

`packages/pupitre-backup/index.ts:67-74` supplies the common fail-closed guard and invocation:

```ts
if (
  typeof policy !== 'function' ||
  !('prototype' in policy) ||
  typeof policy.prototype[ability] !== 'function' ||
  !bouncer
)
  return false
return bouncer.with(policy).allows(ability, record)
```

The same normalization appears in jobs, health, settings, and audit. The following live excerpts identify the non-shareable parts:

- `packages/pupitre-backup/index.ts:48-53`:
  ```ts
  if (
    ctx.pupitre?.panel.tenancy &&
    (!ctx.pupitre.tenant || (record && record.tenantId !== String(ctx.pupitre.tenant.id)))
  )
    return false
  if (options.authorize) return options.authorize(ctx, ability, record)
  ```
  The delete policy also checks `!record.activeLock` and excludes pending/running records at `packages/pupitre-backup/index.ts:122-126`.
- `packages/pupitre-jobs/index.ts:43-46`:
  ```ts
  if (options.authorize) return options.authorize(ctx, ability, record)
  const config = await app.container.make('pupitre.config')
  const policies = await config.policies?.()
  const candidate = policies?.JobRunPolicy
  ```
  Its shared guard checks only the requested method (`index.ts:58-65`); tenant comparison and retry eligibility happen elsewhere, not in this resolver. `packages/pupitre-jobs/index.ts:86-94`:
  ```ts
  const tenant = ctx.pupitre?.tenant?.id
  if (String(tenant ?? '') !== String(record.tenantId ?? ''))
    throw new E_PUPITRE_JOB_FORBIDDEN([t('Job retry is forbidden')])
  if (
    record.status !== 'failed' ||
    !record.retryPayload ||
    !record.retrySafe ||
    !options.allowRetry ||
    !(await options.allowRetry(ctx, record))
  ```
- `packages/pupitre-health/index.ts:34-36`:
  ```ts
  if (options.authorize) return (await options.authorize(ctx)) === true
  const policies = await config.policies?.()
  const candidate = policies?.HealthPolicy
  ```
  `packages/pupitre-health/index.ts:52` invokes `allows('view')` with ONE argument. Preserve its strict callback boolean normalization, unlike the other plugins.
- `packages/pupitre-settings/index.ts:194-197`:
  ```ts
  if (group.settingsScope === 'tenant' && !ctx.pupitre?.tenant) return false
  if (options.authorize) return options.authorize(ctx, group)
  const policies = await config.policies?.()
  const candidate = policies?.SettingsPolicy
  ```
  `packages/pupitre-settings/index.ts:205-206` requires BOTH methods before constructing a gate:
  ```ts
  typeof policy.prototype.viewAny !== 'function' ||
  typeof policy.prototype.manage !== 'function'
  ```
  `packages/pupitre-settings/index.ts:219-220`:
  ```ts
  const gate = bouncer.with(policy)
  return (await gate.allows('viewAny')) && (await gate.allows('manage', group))
  ```
  Construct one gate, preserve argument counts and short-circuit order; do not replace this with two independently resolved checks.
- `packages/pupitre-audit/index.ts:55-61`:
  ```ts
  if (ctx.pupitre?.panel.tenancy) {
    const tenant = ctx.pupitre.tenant
    if (!tenant || (record && record.tenantId !== String(tenant.id))) return false
  }
  if (options.authorize) return options.authorize(ctx, record)
  const policies = await config.policies?.()
  const candidate = policies?.AuditPolicy ?? policies?.ActivityPolicy
  ```
  `packages/pupitre-audit/index.ts:67` chooses `const ability = record ? 'view' : 'viewAny'`. A present but invalid AuditPolicy must NOT cause fallback to ActivityPolicy: fallback is nullish selection before normalization.

**Precise extraction boundary:** unwrap exactly one object `default`; check function/prototype and all caller-requested prototype methods; read request Bouncer and obtain its gate, or return undefined. Keep policy loading, key selection/fallback, callbacks, ability choice, tenant checks, query scoping, record checks, and actual `allows` invocations in each plugin. Do not cache policies/gates or catch loader/Bouncer errors.

The navigation option shape is a string in all three callers (`packages/pupitre-backup/index.ts:32`, `packages/pupitre-jobs/index.ts:27`, `packages/pupitre-health/index.ts:23`). Their fallback expressions are:

```ts
// packages/pupitre-backup/index.ts:144
.navigation({ group: options.navigationGroup ?? t('System') })
// packages/pupitre-jobs/index.ts:182
.navigation({ group: options.navigationGroup ?? t('Administration') })
// packages/pupitre-health/index.ts:133
nav.group(options.navigationGroup ?? t('Administration')).items([nav.item().page(slug)])
```

The kit must return a label, not a navigation builder. Preserve nullish behavior, including an explicit empty string, and keep literal translation keys at caller sites.

### Public contract and package boundaries

`packages/pupitre/src/definition/plugin.ts:41-57` defines `PupitrePlugin` with `name`, `catalog`, `messages`, `register`, `resources`, `pages`, `widgets`, `middleware`, `navigation`, `extendResource`, and `boot`. It contains no Ace command, configure, migration, or stub registration. Package installation is separate from per-panel plugin boot; this plan does NOT add lifecycle fields.

`docs/ARCHITECTURE.md:97` states: "`catalog` → `definition` → `builder` → `compiler` → `query`/`authz`/`tenancy` → `http`" and "`builder` tidak boleh menyentuh `HttpContext`" (builders must not touch HttpContext). `docs/ARCHITECTURE.md:43` forbids core importing `react`, `@inertiajs/react`, or anything from `pupitre-react`/`pupitre-ui`. `docs/ARCHITECTURE.md:253` says plugins define server contributions and do not install React components; the host registers catalog extensions in `defineRegistry(..., { extensions })`.

`packages/pupitre/package.json:88-92` exemplifies source/build subpath mapping:

```json
"./testing": {
  "@rikology/source": "./testing/index.ts",
  "types": "./build/testing/index.d.ts",
  "default": "./build/testing/index.js"
}
```

`packages/pupitre/index.ts:25-26` exports `authorizeResource` and `scopedQuery` from their respective implementation layers. Do not use ordinary resource authorization as the plugin helper: these plugins explicitly fail closed. `packages/pupitre/tsdown.config.ts:4-8` lists explicit entries beginning with `./index.ts`, `./testing/index.ts`, `./catalog/index.ts`, `./configure.ts`; a new subpath needs its own entry. Relative TypeScript imports use `.js`, as in `packages/pupitre/index.ts:25`.

`tools/verify-exports/index.mjs:42-45`:

```js
/**
 * Optional shape checks per `<package name><subpath>`. Subpaths without an
 * entry only need to import cleanly.
 */
```

The verifier iterates all declared exports and imports built default targets at `tools/verify-exports/index.mjs:156-165`. Its header (`index.mjs:6`) says "Run after `npm run build`." A fresh build is therefore a prerequisite, not an optional response to an import failure.

### Scaffolder mechanism and lifecycle exemplars

`packages/create-pupitre-plugin/index.ts:62-67`:

```ts
export interface CreatePluginOptions {
  name: string
  directory: string
  force?: boolean
  withUi?: boolean
}
```

`packages/create-pupitre-plugin/index.ts:128-129`:

```ts
await collect(source)
if (withUi) await collect(join(source, '../template-ui'))
```

Collection overlays files by relative path in a Map; token replacement and symlink-safe writes follow at `index.ts:140-150`. Mirror collection for profile files, but compose package/build/README modifications AFTER overlay selection so UI and lifecycle profiles cannot overwrite one another. Preserve existing no-profile output byte-for-byte.

`packages/create-pupitre-plugin/bin/create.ts:10-13` defines `dir`, `force`, `with-ui`, `help` parseArgs options; `bin/create.ts:24-29` forwards `withUi` to `createPlugin`. Both public API and CLI need each new flag, including help and usage errors.

`packages/create-pupitre-plugin/template/index.ts:7-10` returns `definePlugin({ name: '{{name}}', navigation: [...] })`. The template manager test (`template/tests/plugin.spec.ts:8-20`) boots `IgnitorFactory`, resolves `defineConfig()`, and constructs `PupitreManager`. Keep that real integration test in every profile.

`packages/pupitre-jobs/configure.ts:13-21`:

```ts
if (!exists)
  await codemods.makeUsingStub(
    join(import.meta.dirname, 'stubs'),
    'database/migrations/jobs.stub',
    {}
  )
await codemods.updateRcFile((rcFile) => {
  rcFile.addCommand('@rikology/pupitre-jobs/commands')
})
```

`packages/pupitre-backup/configure.ts:6-18` similarly checks a stable migration destination before publishing and then adds its command loader. Media publishes only a migration (`packages/pupitre-media/configure.ts:15-20`); health publishes a host-owned registry (`packages/pupitre-health/configure.ts:12-13`); shield validates a host table option before publishing and adding commands (`packages/pupitre-shield/configure.ts:8-9,17-25`). These are package-specific installation hooks, not candidates for a universal plugin lifecycle.

`packages/pupitre-backup/commands/main.ts:18-21`:

```ts
export async function getCommand() {
  // Ace must inspect metadata before booting the app; load the command only on execution.
  const command = await import('./run.js')
  return command.default
```

Jobs exposes typed `getMetaData` and `getCommand` (`packages/pupitre-jobs/commands/main.ts:1-3,25-27`), but statically imports its handler. Neither jobs nor backup currently ships `commands/commands.json`; do not invent that evidence. Use core's manifest loader for the requested JSON form: `packages/pupitre/commands/main.ts:16-18` strips `filePath` from metadata, and `main.ts:21-31` finds the requested command, returns null for unknown commands, and dynamically imports the handler. `packages/pupitre/commands/commands.json:27-30` pairs `options: { startApp: true }` with `filePath: "inspect.js"`.

`packages/pupitre-jobs/stubs/database/migrations/jobs.stub:1-5`:

```ts
{{{ exports({ to: app.migrationsPath('1791700000048_create_pupitre_job_runs_table.ts') }) }}}
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pupitre_job_runs'
```

Adonis stub frontmatter is intentionally retained in generated `.stub` files; it is NOT an unresolved scaffolder token. New templates must distinguish these syntaxes.

`packages/pupitre-jobs/package.json:35-44` exports `./configure` and `./commands` with source/types/default mappings; `package.json:60` copies `stubs/**/*.stub` in postcompile. Backup mirrors that (`packages/pupitre-backup/package.json:40-48,59`). Generated packages instead use standard types/default only: `packages/create-pupitre-plugin/template/package.json:17-27` points at compiled output and builds through tsdown plus declaration tsc. UI overlays add `/catalog` and `/react` (`template-ui/package.json:17-29`). Base tsdown has only `entry: ['./index.ts']` (`template/tsdown.config.ts:4`).

`packages/create-pupitre-plugin/package.json:18-23` ships `build`, `template`, `template-ui`, `CHANGELOG.md`, excluding build tests. `tools/verify-exports/packaging.mjs:30-37` permits shipped tests only beneath `template/` or `template-ui/`, then rejects other test directories. Add explicit profile asset requirements and narrowly extend that exemption for the new template directories.

Documentation lives in `packages/create-pupitre-plugin/README.md:18` (UI flag and API option), `README.md:34-45` (programmatic API), and `apps/docs/src/content/docs/plugins.md:66-88` (publishable package authoring). `docs/ARCHITECTURE.md:271` still describes `createPlugin({ name, directory, force? })`; update that paragraph for profiles without rewriting unrelated stale documentation.

### Existing characterization and generator tests

Retain these existing names and assertions, extending coverage rather than weakening them:

- `packages/pupitre-backup/tests/backup.spec.ts:418-427`: "authorization fails closed and rejects another tenant before callback"; absent policy false and cross-tenant callback cannot grant access.
- `packages/pupitre-jobs/tests/jobs.spec.ts:133-162`: "host JobRunPolicy authorizes pages and stats without a callback, missing methods deny"; loops over direct class, `{ default: HostPolicy }`, and undefined, expecting 200/403.
- `packages/pupitre-health/tests/health.spec.ts:86-103`: "authorization fails closed and callback distinguishes tenants and users"; `health.spec.ts:108-129`: "HealthPolicy view uses the host bouncer and denies absent bouncer".
- `packages/pupitre-settings/tests/settings.spec.ts:318-352`: "authorization fails closed and requires viewAny plus manage per group"; missing policy denies, viewAny denial overrides manage permission.
- `packages/pupitre-audit/tests/audit.spec.ts:48-55`: "activity access fails closed without policy or explicit callback"; `audit.spec.ts:58-82`: "configured activity policy controls list and detail independently", expecting calls `['viewAny', 'view']`.
- `packages/create-pupitre-plugin/tests/create.spec.ts:140-164`: "keeps the server-only template unchanged when UI is not requested" compares generated bytes to template bytes. `create.spec.ts:71-105` packs core, links dependencies into a temporary generated package, and runs its `npm test` against published builds, with `NODE_OPTIONS: ''`. Extend this pattern for lifecycle combinations; never rely only on source-condition resolution.
- `packages/pupitre-settings/tests/settings.spec.ts:355-381`: "configure publishes an idempotent migration without overwriting host edits" is the model for generated installation tests.

## Commands you will need

Run from the repository root unless a generated fixture test sets its own cwd. Node 24 and existing npm workspace dependencies are prerequisites; the generator must never install dependencies itself.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Core fast characterization | `npm run quick:test -w packages/pupitre -- --files=tests/plugin_kit.spec.ts` | New kit tests pass |
| First migrated plugin | `npm test -w packages/pupitre-health` | All tests pass |
| Remaining migrated plugins | `npm test -w packages/pupitre-backup -w packages/pupitre-jobs -w packages/pupitre-settings -w packages/pupitre-audit` | All tests pass |
| Scaffolder tests | `npm test -w packages/create-pupitre-plugin` | Existing and profile tests pass |
| Fresh package outputs | `npm run build` | Exit 0; built exports/templates/assets current |
| Typecheck | `npm run typecheck` | Exit 0, no errors |
| Required tests | `npm test -w packages/pupitre -w packages/pupitre-backup -w packages/pupitre-jobs -w packages/pupitre-health -w packages/pupitre-settings -w packages/pupitre-audit -w packages/create-pupitre-plugin` | All pass; core coverage thresholds unchanged |
| Export and package integrity | `npm run verify:exports` | Exit 0; kit shape and profile release assets checked |
| Lint | `npm run lint` | Exit 0 |
| Translation parity | `npm run i18n:check` | Exit 0 |
| Documentation | `npm run check -w apps/docs` and `npm run build -w apps/docs` | Both exit 0 |

Root commands are declared in `package.json:29-39`; docs commands in `apps/docs/package.json:6-14`. Core fast-test and coverage scripts are at `packages/pupitre/package.json:97-99`.

## Scope

**In scope** (only these files or explicitly enumerated new files):

- `packages/pupitre/plugin-kit/index.ts` (new public barrel), `packages/pupitre/src/authz/plugin_policy.ts` (new mechanics), `packages/pupitre/src/definition/plugin_navigation.ts` (new label helper), `packages/pupitre/tests/plugin_kit.spec.ts` (new), `packages/pupitre/package.json`, `packages/pupitre/tsdown.config.ts`, `packages/pupitre/CHANGELOG.md`.
- Each of `packages/pupitre-{backup,jobs,health,settings,audit}/index.ts`, its existing `tests/{backup,jobs,health,settings,audit}.spec.ts` respectively, and its `CHANGELOG.md`.
- `packages/create-pupitre-plugin/index.ts`, `bin/create.ts`, `package.json`, `tests/create.spec.ts`, `README.md`, `CHANGELOG.md`.
- New `packages/create-pupitre-plugin/template-configure/{configure.ts,stubs/config/options.stub,tests/configure.spec.ts}`.
- New `packages/create-pupitre-plugin/template-command/{commands/main.ts,commands/commands.json,commands/info.ts,tests/commands.spec.ts}`.
- New `packages/create-pupitre-plugin/template-migration/{stubs/migrations/create_records.stub,tests/migration.spec.ts}`.
- `tools/verify-exports/index.mjs`, `packaging.mjs`, `index.test.mjs`.
- `apps/docs/src/content/docs/plugins.md`, `docs/ARCHITECTURE.md` (only kit/profile documentation), `plans/README.md` (only this row).

**Out of scope**:

- Existing base/UI templates: preserve their bytes; profile composition happens in generator output, not by broadening every default template.
- `PupitrePlugin` fields, manager lifecycle, ordinary resource policy behavior, tenant adapters/scoping, any new business authorization rule.
- Official configure hooks/commands/migrations (read-only exemplars), plugin-specific retry/deletion behavior, UI or React runtime work, example app, dependencies/version bumps unrelated to generated profiles.
- Ace `make:plugin` forwarding of new flags: document direct CLI/npm-create use; do not silently change core Ace command surface.
- ADR creation is unnecessary: this implements existing package and server-only boundaries. If a genuine architectural conflict requires an ADR, STOP; coordinate a next free number after 0029 rather than inventing one.

## Git workflow

- Inspect `git status --short` once before edits and record pre-existing tracked/untracked paths. Do not claim all dirty files as yours.
- Branch `advisor/002-plugin-kit-and-scaffolder-profiles`; do not discard the current tree to create it. If it exists or work cannot be isolated safely, STOP and report.
- Commit logical units: `feat(core): add fail-closed plugin kit`, `refactor(plugins): share policy resolution mechanics`, `feat(scaffolder): add package lifecycle profiles`, `docs: document plugin kit and lifecycle profiles`.
- Stage only this plan's changes; overlapping user edits require hunk-level staging. Do not push or open a PR.

## Steps

### Step 1: Implement a narrow server-only kit with characterization tests

Use `@rikology/pupitre/plugin-kit` rather than expanding the root barrel: callers explicitly opt into small authoring helpers; catalog remains Zod-only; no application services load just to normalize a policy. Do not add a second root re-export.

Create:

1. `src/authz/plugin_policy.ts`: `resolvePolicyModule(candidate: unknown): unknown`, performing exactly the one-level conditional default unwrap above; `resolvePluginPolicy(ctx, candidate, requiredAbilities)` returning a typed gate or undefined. Use a nonempty readonly ability tuple and a generic argument tuple for gate `allows` so each caller can supply its record/group type without `any`. Accept only the request's structural Bouncer surface, not a container or a policy-name string. Check all requested methods before calling `with`. Keep the internal cast at the structural Bouncer boundary; export useful types from the subpath barrel. No runtime import of app, React, Lucid models, or Bouncer singleton.
2. `src/definition/plugin_navigation.ts`: `pluginNavigationGroup(options: { navigationGroup?: string }, defaultLabel: string): string` returning `options.navigationGroup ?? defaultLabel`. It does not translate or construct nav entries and does not need request context.
3. `plugin-kit/index.ts`: re-export these functions/types with `.js` relative imports.
4. `package.json`: add `./plugin-kit` → source `./plugin-kit/index.ts`, types `./build/plugin-kit/index.d.ts`, default `./build/plugin-kit/index.js`; add the entry to tsdown.
5. Export verifier: assert all three functions on the new subpath. Keep catalog isolation checks intact.

Core tests cover direct/default policy, absent candidate, nonfunction, arrow function without prototype, missing method, multi-method guard, absent Bouncer, exactly one `with` call on success, original policy identity, and errors propagating unchanged. Test default label, explicit label, and empty string. Do not broaden malformed Bouncer validation beyond existing semantics.

**Verify**: `npm run typecheck -w packages/pupitre` and `npm run quick:test -w packages/pupitre -- --files=tests/plugin_kit.spec.ts` → exit 0 and all new cases pass. Then `npm run build && npm run verify:exports` → exit 0, including new kit shape. STOP if the new subpath is rejected; do not fall back to an unverified root export.

### Step 2: Migrate health first and prove unchanged behavior

In `packages/pupitre-health/index.ts`, retain callback normalization and config loading. Select HealthPolicy locally, obtain a gate requiring `['view']`, and return `gate ? gate.allows('view') : false`. Replace its nav label expression with `pluginNavigationGroup(options, t('Administration'))`. Remove only obsolete normalization/Bouncer casts.

Extend existing health tests for default-export policy, strict callback `=== true`, no policy evaluation after callback, and exactly one argument to `allows`. Preserve page/widget access hooks and runner behavior.

**Verify**: `npm run typecheck -w packages/pupitre-health && npm test -w packages/pupitre-health` → exit 0, all original and added health tests pass. Do not migrate the others before this gate is green.

### Step 3: Migrate the other four plugins without moving their authorization rules

- Backup: keep tenancy denial BEFORE callback; locally select BackupPolicy, resolve requested ability, then invoke `allows(ability, record)` even when record is undefined. Replace only the navigation label with `pluginNavigationGroup(options, t('System'))`.
- Jobs: retain container config retrieval AFTER callback; locally select JobRunPolicy and requested ability. Keep retry tenant matching, encrypted payload checks, registration, `allowRetry`, flush timing, and scopes unchanged. Use the label helper with `t('Administration')`.
- Settings: keep tenant-group gate/callback; resolve SettingsPolicy requiring `['viewAny', 'manage']`; one gate and the original short-circuit pair of calls. Do not change settings navigation shape just to use the label helper.
- Audit: retain tenancy gate, callback, nullish AuditPolicy/ActivityPolicy precedence, record-dependent ability, and subject URL security. Resolve chosen ability then make the original `allows(ability, record)` call.

Extend the existing tests with missing method/Bouncer and default-module variants as needed, plus assertions that settings never calls manage when viewAny denies and invalid AuditPolicy does not fall back to ActivityPolicy. Remove dead local casts/imports only. Add relevant core/plugin changelog entries describing behavior-preserving extraction.

**Verify**: `npm test -w packages/pupitre-backup -w packages/pupitre-jobs -w packages/pupitre-settings -w packages/pupitre-audit` → all pass. `npm run typecheck` → exit 0. Search the five plugin entries for the old `candidate.default` normalization → zero occurrences; policy selectors and specific checks still exist.

### Step 4: Add composable lifecycle profiles to the scaffolder

The API decisions are fixed for this plan:

| Decision | Recommended implementation |
| --- | --- |
| Public options / flags | `withConfigure`/`--with-configure`, `withCommand`/`--with-command`, `withMigration`/`--with-migration`, all false by default |
| Dependencies | Command or migration implies configure; flags compose with each other and with UI |
| Installation lifecycle | Adonis package configure hook only; never execute migrations or commands from panel boot |
| Overlay order | base → optional UI → configure → command → migration; collect new files through the existing Map, then perform one composition pass for output index, package.json, build config, README and configure source |
| No-profile compatibility | Skip composition completely when all three lifecycle options are false |
| Command | A real `<name>:info` command that prints generated package/runtime plugin identity; `startApp: false`, no business mock/no-op |
| Migration | Real reversible sample `<snake_name>_records` table with incrementing primary id and timestamp columns; clearly documented as an example authors customize before release |
| Migration destination | Capture one 13-digit `Date.now()` when scaffolding; same destination literal in configure, stub frontmatter, tests and README; never generate a new name at configure time |
| Configure-only behavior | Publish `config/<snake_name>.ts` exporting `{ documentationUrl: 'https://pupitre.rikology.com' }`; generated README shows passing this options object to the factory. UI profile documents its configuration artifact without passing unsupported factory args |

Add the API fields and destructuring defaults. Extend CLI parseArgs, forwarding, help and error usage text. Compute profile-only snake-case/timestamp tokens separately; keep `pluginNames` and its existing default token output unchanged. Generated code must tolerate names such as `app`, `test`, `configure`, and scoped packages by using aliased imports and noncolliding internal bindings.

Implement the enumerated template directories. The configure overlay publishes its config stub only if the destination does not exist. Command profile adds `rcFile.addCommand('<packageName>/commands')` without creating duplicate entries on repeated configure; migration profile adds the stable existence-checked migration publication. Compose these branches into one exported configure function. Export configure from the generated root and `./configure` subpath. No destructive overwrite of installed host files.

Command profile emits typed lazy loader plus JSON manifest and handler. Mirror core manifest structure and unknown-command null result, and backup's lazy-load behavior; source `.ts` and built `.js` execution must both work. Metadata/handler names, descriptions, options and filePath must match.

Migration template emits `stubs/migrations/create_records.stub` with valid Adonis frontmatter. Compose imports/tableName/up/down using generated tokens; no tenant ownership or plugin-specific schema claims. Add Lucid peer/dev dependency only for migration profile; add Adonis core peer when lifecycle profiles require it. Do not add React peers unless UI was explicitly requested.

Compose generated manifest exports with standard types/default entries, preserving existing UI subpaths and dependency ranges. Add configure/command handlers to tsdown entries. Add a generated build-time asset-copy script via package scripts (Node fs mkdir/cp is sufficient) that copies the selected `stubs/` tree and command manifest into matching `build/` paths after tsdown/tsc; no new copyfiles install is needed. Keep published files constrained to build and changelog, excluding tests/bin.

Extend scaffolder package `files` with all three profile directories. In `tools/verify-exports/packaging.mjs`, require representative profile assets and exempt tests only inside those three precise template roots. Extend verifier tests for both allowed template tests and rejected accidental package tests. Never exempt arbitrary `template-*` directories globally.

**Verify**: `npm run typecheck -w packages/create-pupitre-plugin && npm run build` → exit 0. `npm run verify:exports` → all release assets pass. `npm test -w packages/create-pupitre-plugin` → existing no-profile/UI/security tests and new profile tests pass (write them in Step 5 before considering this deliverable complete).

### Step 5: Exercise generated lifecycle packages, not just strings

Extend `tests/create.spec.ts` with a table over all 16 combinations of UI/configure/command/migration flags. For each, assert effective configure dependency, exact expected file set, merged manifest exports/peers/build entries, no unresolved scaffolder tokens, retained Adonis frontmatter, and no files from disabled profiles. Retain no-profile byte-for-byte and force/symlink tests. Add CLI coverage for each flag and combined flags, help, invalid flags and scoped/reserved names.

Generated Japa tests:

- `template-configure/tests/configure.spec.ts`: temporary host directory, codemod fixture like settings; run configure twice; assert one publication, unchanged host edits, expected config destination. If command enabled, assert registration calls yield one rc entry after two installs.
- `template-command/tests/commands.spec.ts`: getMetaData is typed and loads without booting Adonis; correct known handler, unknown command null; execute real info command and assert package/plugin identity output; manifest and handler metadata agree.
- `template-migration/tests/migration.spec.ts`: verify stable destination and stub rendering using actual Adonis codemods in a temporary host; run the rendered migration up/down against disposable SQLite and assert table creation/removal. Never use dev/prod database. Add needed SQLite test dependency to generated migration profile only.

Extend the published-build fixture harness to build generated packages, run their tests, pack them, and inspect actual tarball file paths. Exercise at least configure-only, command-only, migration-only, all lifecycle flags, and UI+all lifecycle flags against packed core without the source condition. Link existing monorepo dependencies for tests; generator must not install. Confirm compiled configure and command subpaths import and built loader reads shipped JSON. Required artifact assertions: compiled configure/loader/handler declarations and JS exist; manifest and stubs exist inside build; source tests and build/tests do not ship. Tests clean temporary trees in finally blocks.

**Verify**: `npm run build && npm test -w packages/create-pupitre-plugin` → exit 0; all combination assertions and real generated build/test/pack cases pass. `npm run verify:exports` → exit 0, including narrow template packaging tests.

### Step 6: Document the public kit and profiles, then run release gates

Update scaffolder README, generated README composition, docs-site `plugins.md`, and the relevant architecture paragraph. Include direct CLI/npm separator examples, API options, implication/composition rules, complete generated file inventory, package configure invocation, nonoverwrite behavior, stable timestamp, command registration, migration customization and host options use. Explain standard generated exports versus monorepo source condition. Document kit imports, required-ability arrays, undefined-deny semantics, plugin-owned callbacks/tenancy, and preserving AuditPolicy precedence/settings checks.

State that UI components remain host-registered and lifecycle flags are not forwarded by Ace make:plugin. Add scaffold changelog entry. Do not promise lifecycle execution during manager boot or claim generated sample storage is production business logic.

**Verify**: `npm run check -w apps/docs && npm run build -w apps/docs` → exit 0. Run sequentially: `npm run build`, `npm run typecheck`, the Required tests command above, `npm run verify:exports`, `npm run lint`, `npm run i18n:check` → every command exits 0. Record only observed results. Update this plan's index row to DONE only after all gates pass.

## Test plan

- Core: new `tests/plugin_kit.spec.ts`, Japa table-driven direct/default/invalid/missing-method/missing-Bouncer cases, multiple required abilities, policy identity, one gate construction, error propagation, navigation fallback/empty label.
- Plugins: extend the five existing characterization files named above; callback precedence, cross-tenant denial, health strict true, argument counts, audit nullish precedence, settings all-method preflight and short circuit. Keep route/stat/retry/record tests green.
- Scaffolder: all 16 flag combinations plus CLI/API agreement, reserved/scoped names, no-profile bytes, with-ui preservation, no accidental output outside target, forced symlink rejection for added nested paths.
- Generated packages: Japa manager integration remains; real configure idempotency, metadata/command execution, disposable SQLite migration up/down, build/pack/import lifecycle assets, published-core resolution without source condition.
- Export verifier: all kit functions checked; profile assets required; precise template-test exemptions versus unrelated tests rejected.
- Verification is the exact Required tests command in Commands plus export/type/lint/i18n/docs gates. Do not substitute a narrow kit-only test run for these end-to-end gates.

## Done criteria

ALL must hold:

- [ ] `@rikology/pupitre/plugin-kit` has source/types/default exports, tsdown entry, and an export shape check for its three functions.
- [ ] Core kit tests exist and pass; five plugin entries import the kit and contain zero duplicate `candidate.default` policy-normalization blocks.
- [ ] Five original characterization suites remain green, with specific authorization rules and navigation fallback labels unchanged.
- [ ] CLI/API expose three lifecycle switches; all 16 combination tests pass; default and UI-only output remain byte-for-byte compatible.
- [ ] Profile templates, real generated Japa tests, configure hook, lazy command loader/JSON/handler, and reversible migration stub are shipped in the scaffolder tarball.
- [ ] Generated lifecycle packages build, pass tests against published core, and pack complete compiled exports/manifest/stub assets without shipping tests.
- [ ] Configure is idempotent, never overwrites installed host files, and command/migration imply configure.
- [ ] `npm run build`, `npm run typecheck`, Required tests, `npm run verify:exports`, `npm run lint`, `npm run i18n:check`, docs check/build all exit 0.
- [ ] README, docs-site authoring page, relevant architecture paragraph and changelogs describe actual behavior.
- [ ] Task diff modifies only the enumerated scope; pre-existing user changes remain intact; index row updated or reviewer explicitly owns it.

## STOP conditions

Stop and report, without improvising, if:

- Any live Current state excerpt differs, including untracked/pre-existing edits that the committed diff does not show.
- The five normalization/gate blocks differ in semantics beyond the explicitly preserved caller-specific rules. Do not force callbacks, method requirements, tenant checks, policy key precedence or argument counts into a universal authorizer.
- Export verification rejects the new subpath, source/build declaration paths, dependency isolation, or profile assets. Do not hide checks, weaken isolation, or export an alternative alias.
- A generated package works only under `@rikology/source`, needs a booted app to enumerate commands, or lacks a manifest/stub in its published output.
- Adonis rc command registration is not idempotent with the chosen codemod pattern; fix and characterize within this scope or report the incompatibility, never insert duplicates silently.
- Stub token replacement corrupts Adonis frontmatter, generated migration destination changes on repeated configure, or installing a profile overwrites host edits.
- Profiles cannot compose with UI while preserving server/browser boundaries, or a no-profile output byte changes unintentionally.
- A prerequisite is missing (Node/dependencies, disposable SQLite support, fresh build feasibility) or a verification fails twice after one reasonable in-scope repair. Record the exact failing command and pre-existing versus introduced evidence; never suppress the gate.
- The implementation requires changing out-of-scope lifecycle, tenant/auth rules, dependencies of existing official plugins, or another advisor plan's files.

## Maintenance notes

- The helper resolves mechanics, not permissions. Future plugin authors own policy naming, callbacks, tenant/record checks and allows-call ordering. Review all callsites whenever the helper guard changes.
- Settings' dual-method preflight and AuditPolicy's nullish precedence are security-sensitive contracts; do not simplify them later by fallback-on-invalid or separately resolving gates.
- Keep template profile asset requirements, manifest metadata, tsdown entries, declaration output and pack assertions in sync when adding another lifecycle profile.
- Timestamps are chosen at scaffold time and reused at installation; changing this needs migration-idempotency tests. Sample schemas are explicitly examples, not invented future plugin storage contracts.
- Later workflow/plugin plans can consume this kit and generator output; this plan does not implement those plugins or add a package lifecycle to PupitrePlugin.
