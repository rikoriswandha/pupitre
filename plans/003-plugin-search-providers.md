# Plan 003: Add panel-scoped plugin and host search providers

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm its expected result before proceeding. If a STOP condition occurs, stop and report; do not improvise. When finished, update only this plan's status row in `plans/README.md`, unless your dispatcher maintains the index.
>
> **Drift check (run first)**: `git diff --stat 4e076fa..HEAD -- packages/pupitre packages/pupitre-ui/src/components/GlobalSearch.tsx docs apps/docs/src/content/docs/guides plans/003-plugin-search-providers.md plans/README.md`. The working tree already contains substantial uncommitted/untracked work, including official plugins and core/UI/example/docs changes. This command cannot detect all of it. ALWAYS compare every Current state excerpt below against the LIVE files, including uncommitted changes; STOP on mismatch. Record the starting dirty-file list with `git status --short`, preserve it, and never restore/stage unrelated changes.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none; plan 002 may improve plugin authoring but is not required
- **Category**: direction
- **Planned at**: commit `4e076fa`, 2026-10-13

## Why this matters

Global search currently discovers only resource records. Plugins offering jobs, media, settings or external records cannot contribute searchable destinations without pretending they are resources. A small server-only provider contract lets plugins and hosts add authorized, tenant-scoped navigation results while reusing the existing palette and wire contract. It also makes one failing plugin unable to erase otherwise usable resource results.

## Current state

The repository is an npm-workspace AdonisJS v7/Inertia React admin framework. This work is core server behavior; do not import React into core or `pupitre-react` into a plugin. Use existing snake_case TypeScript filenames, `.js` relative ESM imports, immutable builders, literal-English `t()` keys with Indonesian dictionary entries when introducing framework UI messages.

### Resource search and route

`packages/pupitre/src/search/query_service.ts:7-8` defines private wire-shaped types:

```ts
type SearchResult = { title: string; details?: string[]; url: string }
type SearchGroup = { resource: string; label: string; results: SearchResult[] }
```

`packages/pupitre/src/search/query_service.ts:69-72` checks policy before scoped access:

```ts
if (!resource.definition.globallySearchable?.length) return undefined
if (!(await authorizeResource(ctx, resource, 'viewAny'))) return undefined

const query = scopedQuery(ctx, resource)
```

`packages/pupitre/src/search/query_service.ts:87-93` caps authorized results, not merely fetched rows:

```ts
for (let batch = 0; batch < maxBatches && results.length < 5; batch++) {
  const records = await query.offset(batch * pageSize).limit(pageSize)
  for (const record of records) {
    const result = await resultFor(ctx, resource, record)
    if (result) results.push(result)
    if (results.length === 5) break
  }
```

`packages/pupitre/src/search/query_service.ts:101-110` is the resource-only orchestration:

```ts
export async function searchResources(
  ctx: HttpContext,
  resources: ResourceRuntime[],
  query: unknown
) {
  const term = typeof query === 'string' ? query.trim() : ''
  if (term.length < 2) return { groups: [] as SearchGroup[] }
  const groups = await Promise.all(resources.map((resource) => searchResource(ctx, resource, term)))
  return { groups: groups.filter((group): group is SearchGroup => group !== undefined) }
}
```

`packages/pupitre/src/search/routes.ts:13-20` passes only the current panel's resources:

```ts
.get('/_pupitre/search', async (ctx) => {
  if (!ctx.pupitre.panel.globalSearch) return ctx.response.notFound()
  const { groups } = await searchResources(
    ctx,
    ctx.pupitre.panel.resources,
    ctx.request.input('q')
  )
  return ctx.response.json({ groups })
```

### Builder, plugin and manager assembly

`packages/pupitre/src/builder/panel.ts:49` declares `globalSearch(options?: { keyBinding?: string } | false): PanelBuilder`. Its implementation at `packages/pupitre/src/builder/panel.ts:224-228` is:

```ts
globalSearch(options: { keyBinding?: string } | false = {}): PanelBuilder {
  return this.set({
    globalSearch: options === false ? null : { keyBinding: options.keyBinding ?? 'mod+k' },
  })
}
```

`packages/pupitre/src/definition/panel.ts:80-81` stores `globalSearch: { keyBinding: string } | null`; `PanelRuntime` inherits this definition via `Omit<PanelDefinition, 'resources' | 'pages' | 'widgets'>` at `packages/pupitre/src/manager.ts:50-54`.

`packages/pupitre/src/definition/plugin.ts:41-57` has no search contribution:

```ts
export type PupitrePlugin = {
  /** Unique kebab-case identifier, e.g. `shield` or `acme-audit`. */
  readonly name: string
  catalog?: readonly CatalogExtension[]
  messages?: LocaleMessages
  register?(panel: PanelBuilder): PanelBuilder | void
  resources?: readonly unknown[] | Record<string, unknown>
  pages?: readonly unknown[] | Record<string, unknown>
  widgets?: readonly unknown[] | Record<string, unknown>
  middleware?: PanelDefinition['middleware']
  navigation?: readonly Definable<NavEntryDefinition>[]
  extendResource?(
    resource: ResourceDefinition<LucidRow>,
    context: PluginResourceContext
  ): ResourceDefinition<LucidRow> | void
  boot?(context: PluginBootContext): void | Promise<void>
}
```

`packages/pupitre/src/builder/plugin.ts:29-32` rejects any unlisted key; therefore adding a type alone is insufficient:

```ts
for (const key of Object.keys(plugin)) {
  if (!PLUGIN_KEYS[key])
    throw new Error(`Unknown key "${key}" in Pupitre plugin "${plugin.name}"`)
}
```

`packages/pupitre/src/plugins/apply.ts:39-43` starts ordered, panel-local assembly:

```ts
export function applyPlugins(input: PanelDefinition): PanelDefinition {
  const plugins = input.plugins ?? []
  mergeCatalogExtensions(plugins.flatMap((plugin) => plugin.catalog ?? []))
  let definition = input
  for (const plugin of plugins) {
```

After each register hook, `packages/pupitre/src/plugins/apply.ts:55-63` appends existing contributions immutably:

```ts
const navigation = (plugin.navigation ?? []).map(navEntry)
definition = {
  ...definition,
  resources: merge(definition.resources, plugin.resources) ?? [],
  pages: merge(definition.pages, plugin.pages) ?? [],
  widgets: merge(definition.widgets, plugin.widgets),
  middleware: plugin.middleware
    ? [...definition.middleware, ...plugin.middleware]
    : definition.middleware,
```

`packages/pupitre/src/manager.ts:181` calls `const definition = applyPlugins(declared)`; `packages/pupitre/src/manager.ts:196` creates `const panel: PanelRuntime = { ...definition, resources, pages, widgets }`. No separate global registry is needed. Public plugin types are exported at `packages/pupitre/index.ts:50-55`.

### Existing client and catalog already support these results

`packages/pupitre/catalog/wire.ts:667-678` is the authoritative schema:

```ts
export const globalSearchResult = z.object({
  title: z.string(),
  details: z.array(z.string()).optional(),
  url: z.string(),
})
export const globalSearchGroup = z.object({
  resource: z.string(),
  label: z.string(),
  results: z.array(globalSearchResult),
})
export const globalSearchResponse = z.object({ groups: z.array(globalSearchGroup) })
export type GlobalSearchResponse = z.infer<typeof globalSearchResponse>
```

`packages/pupitre-ui/src/components/GlobalSearch.tsx:166-180` uses group identity only as a key and navigates on selection:

```tsx
{groups.map((group) => (
  <Command.Group
    key={group.resource}
    heading={group.label}
    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
  >
    {group.results.map((result) => (
      <Command.Item
        key={`${group.resource}:${result.url}`}
        value={`${group.resource}:${result.title}:${result.url}`}
        onSelect={() => {
          setOpen(false)
          setQuery('')
          visit(result.url)
        }}
```

`packages/pupitre-ui/src/components/GlobalSearch.tsx:185-191` renders `result.title` and `result.details.join(' · ')`; `packages/pupitre-ui/src/components/GlobalSearch.tsx:67-70` parses fetched JSON using `globalSearchResponse`. Thus providers need navigation URLs, not action descriptors/callbacks; command-palette mutation actions are explicitly excluded. The group `resource` string can hold a synthetic provider identity without UI/schema edits.

### Documentation constraints and exemplars

- `docs/DESIGN.md:361`: “endpoint `GET /_pupitre/search?q=` menjalankan semuanya paralel dengan batas 5 hasil per resource” (parallel search, five results per resource).
- `docs/ARCHITECTURE.md:97`: “`catalog` → `definition` → `builder` → `compiler` → `query`/`authz`/`tenancy` → `http`” and lower layers may not import higher layers; builders must not execute request-bound work. A type-only `HttpContext` callback declaration belongs in a definition; callback execution belongs in search service.
- `docs/ARCHITECTURE.md:253`: plugin definitions are server contributions; plugins do not install React components or inject renderers. Host registration uses `defineRegistry(..., { extensions })`.
- `docs/ARCHITECTURE.md:255-256`: manager applies plugins in declaration order, immutable register builders, resource/page/widget contributions after host entries.
- `docs/ARCHITECTURE.md:249`: English literal translation keys; `i18n:check` requires Indonesian translations. Keep labels plain strings like the current wire schema; this plan adds no framework UI copy.
- `docs/WIRE_PROTOCOL.md:373-385`: query minimum two trimmed characters, `{ groups: { resource, label, results: { title, details?, url }[] }[] }`, and current resource policy/scope/five-result guarantees.
- `docs/CATALOG.md:117`: `GlobalSearch` invokes `GET /_pupitre/search`; no provider-specific component exists or is needed.
- `apps/docs/src/content/docs/guides/resources.md:67-71` contains the existing “Soft deletes and global search” guide section and resource policy/navigation behavior.
- `apps/docs/src/content/docs/guides/panels.md:46`: `globalSearch({ keyBinding? } | false)` enables search by default with `mod+k`.
- `packages/pupitre/tests/integration/http/global_search.spec.ts:45-53` boots with `createTestApp`, closes via `closeTestApp`, restores policy state, and tears down DB. The existing URL-tenancy test at `packages/pupitre/tests/integration/http/global_search.spec.ts:175-198` resolves `acme`/`globex` to tenant IDs 1/2 and scopes ownership through a `TenancyAdapter`.
- `packages/pupitre/tests/integration/plugins.spec.ts:28-44` tests ordered registration using `definePlugin` and the public manager fixture; `packages/pupitre/tests/integration/plugins.spec.ts:148-155` tests invalid names, unknown keys and non-function hooks.
- `package.json:30-39` defines workspace typecheck/test and root lint/i18n checks. `packages/pupitre/package.json:96-99` defines `typecheck`, `quick:test`, and `test` with 85% line coverage gates for compiler/query/authz. `apps/docs/package.json:9-13` defines content preparation before `astro check`.

## Commands you will need

Run from repository root with existing Node 24/npm dependencies. Do not install or regenerate registries for this feature.

| Purpose | Command | Expected on success |
|---|---|---|
| Starting tree | `git status --short` | Existing changes recorded; never discard them |
| Branch | `git switch -c advisor/003-plugin-search-providers` | New branch; dirty tree preserved |
| Core typecheck | `npm run typecheck -w packages/pupitre` | Exit 0, no TypeScript errors |
| Search integration | `npm run quick:test -w packages/pupitre -- --files=tests/integration/http/global_search.spec.ts` | All existing and new search tests pass |
| Plugin integration | `npm run quick:test -w packages/pupitre -- --files=tests/integration/plugins.spec.ts` | All existing and new plugin tests pass |
| Core full gate | `npm test -w packages/pupitre` | All tests pass; all three 85% coverage gates hold |
| Lint | `npm run lint` | Exit 0, no lint errors |
| Translations | `npm run i18n:check` | Exit 0, no missing Indonesian keys |
| Docs | `npm run check -w apps/docs` | Exit 0, no Astro/content errors |

## Scope

**In scope** (only modify these implementation/documentation files):

- `packages/pupitre/src/definition/search.ts` (create: public types only)
- `packages/pupitre/src/definition/plugin.ts`
- `packages/pupitre/src/definition/panel.ts`
- `packages/pupitre/src/builder/plugin.ts`
- `packages/pupitre/src/builder/panel.ts`
- `packages/pupitre/src/plugins/apply.ts`
- `packages/pupitre/src/search/query_service.ts`
- `packages/pupitre/src/search/routes.ts`
- `packages/pupitre/index.ts`
- `packages/pupitre/tests/integration/http/global_search.spec.ts`
- `packages/pupitre/tests/integration/plugins.spec.ts`
- `docs/DESIGN.md`
- `docs/ARCHITECTURE.md`
- `docs/WIRE_PROTOCOL.md`
- `apps/docs/src/content/docs/guides/resources.md`
- `apps/docs/src/content/docs/guides/panels.md`
- `plans/README.md` (only plan 003 status), `plans/003-plugin-search-providers.md` (decision/status annotations only)

**Out of scope**:

- Catalog schema, UI palette, React runtime, registry artifacts, generated types, dependencies, example app and other official plugin implementation files.
- Action execution, external-search adapters, ranking across providers, fuzzy matching, caching, retries, timeouts, pagination and per-provider custom caps.
- Changing resource authorization, tenancy, error behavior, its authorized-row batching, or its order.
- New ADR: existing server contribution and wire decisions suffice. If a genuinely incompatible design requires one, STOP; any approved ADR must use the next free number after 0029, not an occupied number.

## Git workflow

- Branch `advisor/003-plugin-search-providers`; do not stash/reset existing edits. If this branch exists or switching would conflict, STOP and report instead of forcing it.
- Commit only your task hunks, not whole pre-dirtied files. Conventional messages: `feat(core): add panel search providers`, `docs: document plugin search providers`.
- No push or PR unless explicitly requested.

## Steps

### Step 1: Freeze the provider decisions and add the typed contract

Record the following decisions in this plan before implementing; they are recommended defaults and together define this feature. Do not turn unresolved API questions into permissive fallback code.

| Decision | Default and reason |
|---|---|
| Plugin naming | `search?: readonly SearchProvider[]` on `PupitrePlugin`; existing contribution nouns are short plural/domain names |
| Host API | `.globalSearch({ keyBinding?, providers?: readonly SearchProvider[] })`; update both public signature and implementation |
| Provider contract | `SearchProvider = { id: string; label: string; search(ctx: HttpContext, term: string): Promise<SearchResult[]> }` |
| Wire result | `SearchResult = GlobalSearchResponse['groups'][number]['results'][number]`, type-only import from catalog; one source of truth |
| Identity | Provider IDs must be nonempty kebab-case, unique across all host/plugin providers in one panel; group identity `provider:${id}` cannot collide with resource slugs |
| Ordering | Existing resource groups first; host providers next; plugin providers in plugin declaration order, preserving their array order; omit empty groups |
| Limits | Five results per provider, preserving provider order; provider should already authorize, scope, order and limit its database work before returning |
| Request/security | Actual current `HttpContext`; provider author checks permission before querying, scopes to `ctx.pupitre.tenant`, authorizes destination/record, returns `[]` on denial; core cannot infer policy for arbitrary stores |
| Failure | Catch each provider's synchronous throw or rejected promise and omit only that group; do not catch resource failures. Independent optional contributions must not break normal resource search. No returned error message, retries or new telemetry |
| Disabled search | `null` remains authoritative: plugin contributions must not re-enable search; no provider executes and endpoint stays 404 |
| Host replacement | A repeated `.globalSearch(...)` replaces previous host options/providers, matching the current setter; immutable copy of supplied array |
| Navigation | `url` is a host-owned authorized GET destination with the active panel/tenant segment; never an action, JS URL or POST endpoint. One result per URL per provider, because existing React keys use URL |

Create `src/definition/search.ts` containing only exported `SearchResult`/`SearchProvider` types. Export them from `packages/pupitre/index.ts`. Add `search` to `PupitrePlugin` and to `PLUGIN_KEYS`, check a supplied plugin search contribution is an array, and update contribution-order comments. Extend panel definition search options with optional `providers` (keep old handwritten definitions valid); copy host provider arrays in the immutable builder. Do not call providers during builder execution.

Open questions are deliberately bounded: confirm the defaults above with the operator only if they reject the specified navigation-only API or provider-owned authorization. Otherwise proceed; no external service, adapter, design-spike dependency or plan 002 prerequisite is missing.

**Verify**: `npm run typecheck -w packages/pupitre` → exit 0; `npm run quick:test -w packages/pupitre -- --files=tests/integration/plugins.spec.ts` → all existing tests pass.

### Step 2: Merge and validate providers through normal panel resolution

In `src/plugins/apply.ts`, append each `plugin.search` after that plugin's register hook, alongside existing contribution merging. Only append when `definition.globalSearch !== null`; never re-enable disabled search. Create new options/arrays without mutating the input or plugin arrays. Host providers already reside in `globalSearch.providers`; no process-global map or new manager registry.

At the end of `applyPlugins`, validate every effective provider: object, kebab-case ID, nonempty string label, callable `search`, and no duplicate ID across host/plugins/register-hook contributions. Invalid registration throws a deterministic diagnostic identifying panel/provider, before any request. Validate contributions' arrays before spreading them. Disabled panels do not have an effective provider list and do not execute callbacks. Keep the established manager spread at resolution unchanged: `PanelRuntime` inherits the new field automatically.

Add tests in `tests/integration/plugins.spec.ts`: `definePlugin({ search: [...] })` is accepted; non-array search is rejected; manager resolves host then plugin providers in declaration order; arrays/input definitions remain unchanged; duplicate IDs host/plugin and plugin/plugin fail; bad ID/label/callback fails resolution; distinct panels may use the same ID; a disabled panel stays disabled even with a search-contributing plugin.

**Verify**: `npm run quick:test -w packages/pupitre -- --files=tests/integration/plugins.spec.ts` → all new and existing tests pass; `npm run typecheck -w packages/pupitre` → exit 0.

### Step 3: Execute provider searches and reuse the existing response shape

In `src/search/query_service.ts`, replace the private duplicate `SearchResult` with the public type. Add a small internal `searchProvider(ctx, provider, term)` helper: inside its own try/catch, await `provider.search(ctx, term)`, keep the first five results with `.slice(0, 5)`, return `{ resource: 'provider:' + provider.id, label: provider.label, results }` if nonempty; on callback failure return `undefined`. Keep results typed, do not add action variants or fabricate results on denial/failure.

Extend existing `searchResources` with a fourth required argument `providers: readonly SearchProvider[]`; migrate every repository caller found by searching for `searchResources` (known route caller should be the only production one). Retain the existing trimming/minimum-length early return so no callback runs for short/non-string terms. Run resource tasks and provider tasks in one `Promise.all` array, resources first, preserving declaration order independent of completion timing. Per-provider catches isolate failures without hiding resource database/policy failures. Filter undefined groups exactly as today. No legacy wrapper/alias is required.

Update `src/search/routes.ts` to pass `ctx.pupitre.panel.globalSearch.providers ?? []` after `q`, using the already-established enabled-search guard. This uses the resolved current panel only; never read providers directly from all installed plugins or cache request results. No changes to catalog JSON, client search metadata or palette rendering.

**Verify**: `npm run typecheck -w packages/pupitre` → exit 0; `npm run quick:test -w packages/pupitre -- --files=tests/integration/http/global_search.spec.ts` → existing search behavior unchanged.

### Step 4: Prove authorized, resilient, tenant-isolated provider results over HTTP

Extend `tests/integration/http/global_search.spec.ts` using public `definePanel`, `definePlugin` and the existing `createTestApp`/cleanup pattern, not a mocked route/service. Parse every successful response with `globalSearchResponse`. Use isolated temporary fixtures and existing database models, not a real external plugin service.

Write named tests covering all cases in the Test plan. For provider-owned security, use an explicit permission condition on the request (or existing authorization helper) before querying, and return `[]` on denial. For tenant isolation, adapt the existing `acme`/`globex` TenancyAdapter test; use the active `ctx.pupitre.tenant` to scope seeded rows belonging to IDs 1/2, and form tenant-qualified URLs. Request both tenants and assert no foreign titles/URLs. This proves the contract passes tenant context and the provider implements scoping; it must not falsely claim core automatically secures arbitrary callbacks.

**Verify**: `npm run quick:test -w packages/pupitre -- --files=tests/integration/http/global_search.spec.ts` → all provider and existing search tests pass; `npm test -w packages/pupitre` → full suite and compiler/query/authz 85% coverage gates pass.

### Step 5: Document the contract and run final gates

Update the existing global-search section of `apps/docs/src/content/docs/guides/resources.md` with a complete typed plugin example and host `.globalSearch({ providers: [...] })` example. Show the permission check before database access and explicit active-tenant predicate, with authorized tenant-qualified navigation destinations; do not leave placeholder security functions that could be mistaken for working protection. Reuse public exports and a clearly explained host model/policy context. Explain trimmed minimum query, IDs/ordering/cap, empty/failed provider omission, disabled search, and that providers must bound their own database work. Update the panels builder surface row.

Update `docs/WIRE_PROTOCOL.md` even though the schema stays unchanged: `resource` now identifies resource groups OR `provider:<id>` groups, with five-result cap per source; resource policies remain automatic but providers own authorization/tenancy; failed provider groups are omitted; URLs are navigation-only. Preserve schema field names and the JSON contract. Update `docs/DESIGN.md` search paragraph and `docs/ARCHITECTURE.md` plugin contribution list/order to include search. `docs/CATALOG.md` needs no change because neither component API nor catalog schema changes.

Run each final gate once after implementation and docs have landed. Compare final changes to the recorded dirty baseline; only task-owned changes must be within Scope. Update plan 003's index status only after all gates pass.

**Verify**: `npm run typecheck -w packages/pupitre`, `npm test -w packages/pupitre`, `npm run lint`, `npm run i18n:check`, `npm run check -w apps/docs` → each exits 0; core coverage remains at least 85% for each existing gated directory. `git diff --name-only` plus `git status --short` → no newly introduced out-of-scope edits (pre-existing unrelated edits remain untouched).

## Test plan

Structural exemplars: `packages/pupitre/tests/integration/http/global_search.spec.ts`, especially the existing URL-tenancy test, and `packages/pupitre/tests/integration/plugins.spec.ts` for ordered manager contributions and declaration failures.

Add HTTP integration cases:

1. Host and plugin providers return title/details/navigation URL in distinct `provider:<id>` groups alongside resource groups; schema parsing succeeds without changing the client.
2. Provider receives the actual request context and trimmed term, and groups retain resource/host/plugin declaration ordering even with differently delayed callbacks.
3. Provider returning seven results exposes exactly its first five; empty provider omitted.
4. Unauthorized provider returns nothing and does not query its store; unrelated allowed resource results remain visible.
5. A throwing provider is omitted while resource and other provider results survive with HTTP 200; include an asynchronously rejected promise as well as a synchronous throw.
6. Active-tenant provider results and URLs are isolated for both acme/globex requests, with no result reuse across requests.
7. Providers attached only to panel A never run/appear in panel B, even with matching provider IDs.
8. Short/whitespace queries do not invoke providers; disabled search with plugin providers stays HTTP 404 and invokes none.

Add registration/assembly cases specified in Step 2, including immutable input preservation and duplicate IDs. Preserve all existing policy fallback, resource cap, relation search and tenant scope tests. The provider callback owns result uniqueness and correct field types; do not broaden this task into untrusted runtime payload validation.

Verification: both scoped `quick:test` commands above pass with these new cases; `npm test -w packages/pupitre` passes the complete suite and coverage gate.

## Done criteria

ALL must hold:

- [ ] `src/definition/search.ts` exists and public root exports expose typed `SearchProvider` and `SearchResult`.
- [ ] `PupitrePlugin.search` and both public/implemented `.globalSearch({ providers })` signatures compile with a typed callback using `HttpContext`.
- [ ] Manager integration tests pass for host/plugin ordered merging, immutability, duplicate/invalid declarations, panel separation and disabled search.
- [ ] HTTP search integration tests exist and pass for appearance, five-result cap, denied access, thrown/rejected provider resilience and both-direction tenant isolation.
- [ ] Every `searchResources` caller passes the resolved panel provider list (or explicit empty list in tests); no obsolete signature wrapper remains.
- [ ] `npm run typecheck -w packages/pupitre` exits 0.
- [ ] `npm test -w packages/pupitre` exits 0 with all compiler/query/authz 85% coverage checks unchanged.
- [ ] `npm run lint`, `npm run i18n:check`, `npm run check -w apps/docs` each exit 0.
- [ ] The two docs-site guide sections and three design/protocol documents describe the implemented semantics.
- [ ] Catalog schema and UI/client source remain unchanged by this task; existing `globalSearchResponse` parses provider results.
- [ ] No task-created changes outside Scope; pre-existing changes preserved; plan 003 index row updated by its designated owner.

## STOP conditions

Stop and report rather than improvise if:

- Any live Current state excerpt differs, including because another agent edited an uncommitted file. Refresh the plan with the dispatcher before implementation.
- Provider results require mutation/action execution rather than existing `visit(url)` navigation, or a schema/client change is necessary.
- The operator rejects provider-owned permission/tenant checks; a new automatic authorization contract needs a separate design, not a permissive fallback.
- Effective provider IDs cannot be kept unique within a panel, or register hooks require re-enabling disabled search to merge contributions.
- Existing manager resolution does not preserve `globalSearch.providers`, or a fix requires a file outside Scope.
- Any verification fails twice after a reasonable task-scoped fix; report the exact failing gate and distinguish unrelated dirty-tree failure without altering unrelated code or weakening coverage.
- Node/dependencies or the existing fixture test environment are unavailable; report the missing prerequisite instead of installing or changing dependencies.

## Maintenance notes

- Review callback examples as security-sensitive server code: deny before searching, use the active resolved tenant, authorize the destination and emit no forbidden record metadata. An integration test is not a sandbox for arbitrary plugin code.
- Prefixing group IDs prevents resource/provider key collisions; result URLs must be unique within a provider because the unchanged palette uses `${group.resource}:${result.url}` as its item key.
- Failure isolation is limited to optional providers. It intentionally does not hide resource errors or registration misconfiguration. A never-settling callback can still delay the request; deadlines/retries are outside this feature and need their own explicit design.
- Provider array order is deterministic; do not introduce cross-provider ranking or caches without revisiting documented behavior and tenant-isolation tests.
- Future action-capable search requires a new wire/client design. This plan deliberately delivers navigation-only provider search, not command execution.
