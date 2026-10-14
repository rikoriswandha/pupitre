# Plan 007: AG-UI agent endpoint and chat surface as an official plugin (`pupitre-agent`, ADR-0030)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm its expected result before moving on. On a STOP condition, report rather than improvise. When complete, update only this plan's status row in `plans/README.md` unless your dispatcher maintains the index.
>
> **Drift check (run first)**: `git diff --stat ae03b15..HEAD -- packages/pupitre/index.ts packages/pupitre/src/compiler/action_compiler.ts packages/pupitre/src/compiler/table_compiler.ts packages/pupitre/src/http/router.ts packages/pupitre/src/http/controllers/resource_controller.ts packages/pupitre/src/search/query_service.ts packages/pupitre/src/query/table_query.ts packages/pupitre/src/query/query_builder.ts packages/pupitre/src/table/table_data.ts packages/pupitre/src/table/table_summary.ts packages/pupitre/src/table/export_service.ts packages/pupitre/src/definition/plugin.ts packages/pupitre/src/definition/table.ts packages/pupitre/catalog/wire.ts packages/pupitre-kanban/index.ts packages/pupitre-ui/src/components.ts packages/pupitre-ui/src/components/KanbanBoard.tsx packages/pupitre-react/src/index.ts packages/pupitre-react/src/hooks/widget.ts packages/pupitre-react/src/bridge/actions.ts packages/pupitre-transmit/client/index.ts package.json apps/example/app/admin/panels/admin.ts apps/docs/astro.config.ts tools/bundle-budget/budgets.json docs/adr plans/README.md`
> **Compare every Current state excerpt below with the LIVE files even if that command reports nothing.** STOP on an excerpt mismatch; preserve every unrelated working-tree change.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: — (`plans/002-plugin-kit-and-scaffolder-profiles.md` optional: use its kit for policy resolution if DONE; otherwise copy the `authorize` callback pattern from `pupitre-jobs`/`pupitre-health`. Do not implement 002 here.)
- **Category**: direction
- **Planned at**: commit `ae03b15`, 2026-10-14

## Why this matters

Operators increasingly expect an assistant inside the admin panel ("find the refunded orders from last week", "how many orders are pending per tenant", "mark this shipped"). The protocol layer for that is now standardized: AG-UI 1.0 (JSON over SSE, `RunAgentInput` → `RUN_STARTED … RUN_FINISHED`), consumed by CopilotKit and other clients. Pupitre already owns the hard parts an agent needs — authenticated tenant-scoped routes, a server-side authorization/validation path for actions (`executeAction`), scoped global search, and a programmatic table pipeline (`applyTableQuery` → `buildTableData` / `aggregateTableSummaries`) that the CSV export already drives without a controller — so an AG-UI endpoint is mostly composition.

The decision this plan locks in: **Pupitre speaks AG-UI; CopilotKit is one optional client, never a dependency.** `@copilotkit/runtime@1.79.0` pulls graphql-yoga, hono, type-graphql, `ai`, `openai`, pino, ws and Segment analytics; `@copilotkit/react-core@1.79.0` pulls lit, katex, streamdown, radix and scarf telemetry. Both violate the layered-minimal-dependency posture (`docs/ARCHITECTURE.md:39-55`), the bundle budgets (`tools/bundle-budget/budgets.json`) and the "glassy AI-SaaS" anti-reference in `PRODUCT.md:29`. `@ag-ui/core@1.0.2` has zero runtime dependencies (peer `zod ^3.25.18 || ^4`), which Pupitre already requires for the catalog.

Non-goals of this plan: thread persistence tables, multi-agent/subagent events, generative UI (A2UI/MCP-UI), voice, a hosted LLM proxy, replacing global search with the agent, or exposing the endpoint to non-browser clients (no API tokens; the endpoint lives inside the session/Inertia panel group like every `/_pupitre/*` route).

## Current state

All excerpts below were read from the live tree at `ae03b15`.

### Plugin contract and route registration

`packages/pupitre/src/definition/plugin.ts:41-57` is the whole plugin surface. There is no `routes` hook; routes are registered from `boot`:

```ts
export type PupitrePlugin = {
  readonly name: string
  catalog?: readonly CatalogExtension[]
  messages?: LocaleMessages
  register?(panel: PanelBuilder): PanelBuilder | void
  resources?: readonly unknown[] | Record<string, unknown>
  pages?: readonly unknown[] | Record<string, unknown>
  widgets?: readonly unknown[] | Record<string, unknown>
  middleware?: PanelDefinition['middleware']
  navigation?: readonly Definable<NavEntryDefinition>[]
  extendResource?(resource: ResourceDefinition<LucidRow>, context: PluginResourceContext): ResourceDefinition<LucidRow> | void
  boot?(context: PluginBootContext): void | Promise<void>
}
```

`packages/pupitre/src/http/router.ts:85-92` — the `tenant` group applies panel middleware (host Shield/session), authenticated context, `BrowserSessionMiddleware`, tenancy resolution and shared props:

```ts
    tenant: (register) =>
      group(register, tenantPrefix, [
        ...panel.middleware,
        context(Boolean(panelGuard(panel))),
        (ctx, next) => new BrowserSessionMiddleware().handle(ctx, next),
        tenancy,
        share,
      ]),
```

`packages/pupitre-backup/index.ts:235-264` is the exemplar for a plugin-owned route that streams a response: `panelRouteGroups(router, panel).tenant(() => router.get('/_pupitre/backups/:id/download', …).as('backups.download'))`, authorization via `authorizeResource(ctx, runtime, 'viewAny')`, scoped lookup through `lookupOrNull(() => scopedQuery(ctx, runtime)…)`, then `return ctx.response.stream(await storage.getStream(record.path))` (line 261). `@adonisjs/transmit` itself serves SSE through the same primitive (`node_modules/@adonisjs/transmit/build/src/controllers/event_stream_controller.js:24`: `return ctx.response.stream(stream)`), so `response.stream` is proven for `text/event-stream` on this stack.

### Public core helpers available to a plugin

`packages/pupitre/index.ts:24-28,236-237,252,257-258` export `resolveAdapter`, `authorizeResource`, `scopedQuery`, `compileValidator`, `resolveTranslations`, `stripTranslationMarkers`, `createPupitreStorage`, `panelRouteGroups`, `lookupOrNull`. **Not exported**: `executeAction` (`packages/pupitre/src/compiler/action_compiler.ts:337-349`) and `searchResources` (`packages/pupitre/src/search/query_service.ts:101-110`):

```ts
export async function executeAction<T = LucidRow>(
  action: ActionDefinition,
  options: {
    ctx: HttpContext
    record?: T
    records?: T[]
    data: unknown
    authorize(ability: string, record?: T): Promise<boolean>
    currentUrl: string
    listUrl: string
    beforeHandle?(data: Record<string, unknown>): Promise<void>
  }
): Promise<ActionResult> {
```

`executeAction` (`action_compiler.ts:350-384`) already enforces `action.visible`, the configured ability against every target, VineJS validation of `action.form`, then `handle` — exactly the gate an agent tool must pass through. `searchResources` (`query_service.ts:64-99`) already applies `globallySearchable`, `viewAny`, scope/tenancy, and per-record `view`/`update` checks and caps results at 5 per resource.

### Table pipeline is already programmatic

`packages/pupitre/src/query/table_query.ts:131-136,329` takes URL-shaped params and returns the scoped, validated query:

```ts
export function applyTableQuery(
  query: ModelQueryBuilderContract<LucidModel, LucidRow>,
  table: TableDefinition,
  params: Record<string, unknown>,
  options: QueryOptions = {}
): QueryResult {
  …
  return { query, normalized, perPage, page }
}
```

It validates `sort` against `sortable` columns (`E_PUPITRE_INVALID_SORT`, lines 164-169), applies `q` over `searchable` columns (181-184), per-column searches (189-215), `groupBy` (216-224), every filter kind (230-291: `queryBuilder` → `applyQueryBuilder`, `trashed`, `custom` → callback, `select`, `ternary`, date range), the list `tabs` with first-tab default (295-309) and `perPage` only from the table's declared choices (311-327). `TableFilterDefinition` (`packages/pupitre/src/definition/table.ts:159-165`) is `Select | Ternary | DateRange | Custom | Trashed | QueryBuilder`. The query-builder value is a JSON string `{ groups: Rule[][] }` with `Rule = { constraint, operator, value?, negated? }`, strictly validated against the filter's declared constraints and operators before any SQL (`packages/pupitre/src/query/query_builder.ts:20-78`; caps: 8 groups, 16 rules per group, 64 total, 8 KiB).

`packages/pupitre/src/table/export_service.ts:38-71,80-81` is the controller-free exemplar this plan copies: `scopedQuery(ctx, resource, { trashed })`, preload of dotted relation columns, `applyTableQuery(query, table, params, { ctx, tabs: resource.definition.pages.list?.tabs })`, then `queryResult.query.clone().clearOrder().count('* as total').pojo().first()` for the total and `buildTableData(table, records, total, { ctx, locale, timezone, normalized, rowActions: async () => [], rowUrl: () => undefined })` for locale/timezone-formatted cells (`packages/pupitre/src/table/table_data.ts:231-236`; options type lines 20-33). `aggregateTableSummaries(query, table, { normalized, … })` (`packages/pupitre/src/table/table_summary.ts:66-71`) computes configured `count/sum/avg/min/max/range` summaries in SQL, optionally grouped by `normalized.groupBy`.

The client-facing descriptor is the right source for a tool schema: `compileTable(table, options)` (`packages/pupitre/src/compiler/table_compiler.ts:124-127`, called by the list controller at `resource_controller.ts:531-549` with `{ url, id, tabs, bulkActions, emptyStateAction, compileFilterForm }`) yields `TableDescriptor` whose `columnDescriptor` carries `label/sortable/searchable/toggleable/summarize` (`packages/pupitre/catalog/wire.ts:91-118`) and whose `filterDescriptor` (`wire.ts:123-150`) carries resolved select `options` and, for `queryBuilder`, every constraint's `type`, `options` and allowed `operators: [{ value, label }]`. Labels in the descriptor are already `t()` results. **None of `compileTable`, `applyTableQuery`, `buildTableData`, `aggregateTableSummaries` are exported from `packages/pupitre/index.ts`** (grep at planning time: no matches), and `queryOperators` (`src/query/query_operators.ts`) is not public either — the descriptor's `operators` list is the only public form.

### Action metadata is UI-shaped, not tool-shaped

`packages/pupitre/src/definition/schema.ts:458-480` enumerates `FieldDefinitionUnion`: `ExtensionFieldDefinition | Text | Number | Slider | Textarea | Select | Checkbox | CheckboxList | Radio | Toggle | ToggleButtons | Date | Color | Tags | KeyValue | MarkdownEditor | CodeEditor | RichEditor | FileUpload | Repeater | Builder | Hidden`. Layouts (`wizard`, `grid`, `section`, lines 481-493) wrap `children`. Action forms are `SchemaNodeDefinition[]` validated by `compileValidator` (`vine_compiler.ts:869`). There is no JSON Schema projection anywhere; `actionDescriptor` in `packages/pupitre/catalog/wire.ts:25-83` carries `name/label/kind/url/method/enabled` plus modal/confirm presentation. `requiresConfirmation()` compiles into a UI descriptor only (`action_compiler.ts:139-153`); the POST path has no confirmation token. **An agent must therefore implement its own confirmation barrier** — the AG-UI interrupt contract.

### How an official plugin ships UI today

`packages/pupitre-kanban/index.ts:206-221`:

```ts
  const widget = defineWidget(`kanban-${options.page.slug}`)
    .component('KanbanBoard', load)
    .actions([move])
    .span('full')
    .lazy(false)
    .canView(access)
  const page = definePage(options.page.slug)
    .title(options.page.label)
    .navigation({ label: options.page.label, group: options.page.navigationGroup })
    .canAccess(access)
    .widgets([widget])
  const requestContext = new AsyncLocalStorage<HttpContext>()
  const plugin = definePlugin({
    name: `kanban-${options.page.slug}`,
    pages: [options.page.icon ? page.icon(options.page.icon) : page],
```

`packages/pupitre-ui/src/components.ts:7,83` imports and registers `KanbanBoard`; `packages/pupitre-ui/src/components/KanbanBoard.tsx:1-29` is a `lazy(() => import('./KanbanBoardBody.js'))` shell with `Suspense` and props `{ data: unknown; descriptor: WidgetDescriptor }`. `packages/pupitre-react/src/index.ts:17-18,26-27` exports `t`, `useWidget`, `jsonFetch`, `xsrfToken`. `packages/pupitre-react/src/bridge/actions.ts:55-73` — `jsonFetch` adds `X-XSRF-TOKEN` on non-GET and `credentials: 'same-origin'`, which is what a same-origin AG-UI client must do. `packages/pupitre-react/src/hooks/widget.ts:26-28` derives URLs from `descriptor.dataUrl`; a chat component gets its endpoint from the widget loader payload instead.

There is **no persistent panel-wide slot**: `packages/pupitre-react/src/shell/types.ts:16-38` (`ShellProps`) has no aside/slot field and `ShellRegistry` (lines 93-102) only lets the host swap the whole `Shell`. The chat therefore ships as a custom page in this plan; a drawer is deferred (see ADR open questions).

### Realtime, i18n, packaging

- `pupitre-transmit` cannot carry AG-UI: `packages/pupitre/catalog/wire.ts:6-12` types `RealtimeEvent` as `pupitre:notification | pupitre:table` and the client drops anything else (`packages/pupitre-transmit/client/index.ts:70-73`). A separate POST+SSE endpoint is required.
- `packages/pupitre/CHANGELOG.md:17`: server `t()` returns readable text **plus invisible signed markers**. Anything leaving through a non-standard response boundary (an SSE stream, an LLM prompt) must pass `resolveTranslations()` / `stripTranslationMarkers()` first.
- `package.json:10-27` lists workspaces explicitly; `package.json:29` enumerates `build -w …` packages ending with `-w packages/pupitre-backup -w packages/create-pupitre-plugin`. `apps/docs/astro.config.ts:22-33` has the "Official plugins" sidebar (`plugins/shield … plugins/backup`). `apps/docs/src/content/docs/plugins/kanban.md:1-6` is the doc frontmatter exemplar. `tools/bundle-budget/budgets.json` caps `largestLazy` at 269932 gzip.
- `apps/example/app/admin/panels/admin.ts:93-124` registers plugins with `authorize: (ctx) => (ctx.auth.user as User | undefined)?.email === 'admin@example.com'` for media/jobs/health — copy that gate.
- `packages/pupitre/tests/integration/authz/matrix.spec.ts:15,123-127` fails on any unclassified panel route in the core test app; plugin routes registered only in the plugin's own test app are not covered by it, but if the example app grows a route-matrix test, classify `admin.agent.run`.
- `docs/adr/0000-template.md` headings: `Konteks`, `Keputusan`, `Alternatif yang ditolak`, `Konsekuensi` (English content under those headings). ADR directory ends at 0026; 0027–0029 are reserved by plans 001/004/006. **Use `0030-ag-ui-agent.md`**; verify free before creating.
- `docs/FILAMENT_PARITY.md:211` groups unplanned items; Filament has no first-party assistant, so add a separate row labelled "Beyond Filament" rather than editing the parity claim.

### AG-UI 1.0 facts the implementation must honour (from https://docs.ag-ui.com, read 2026-10-14)

- Transport: `POST` body `RunAgentInput` (`threadId`, `runId`, `messages`, `tools`, `context`, `state`, `forwardedProps`, optional `resume`, `protocolVersion`); response `text/event-stream`, one `data: <json>\n\n` per event.
- Producer MUST set `protocolVersion` (SDK constant `PROTOCOL_VERSION`) on `RUN_STARTED`; never echo the client's value.
- `RunAgentInput.tools` is **only** for client-provided (frontend) tools. Backend tools stay server-side.
- Interrupts: end the run with `RUN_FINISHED { outcome: { type: 'interrupt', interrupts: [{ id, reason: 'tool_call', toolCallId, message, responseSchema?, expiresAt? }] } }`; the client's next `RunAgentInput` on the same `threadId` carries `resume: [{ interruptId, status: 'resolved' | 'cancelled', payload? }]`. Denial is expressed in `payload`, not status. A resume must address every open interrupt; a run on a thread with pending interrupts and no `resume` MUST produce `RUN_ERROR`. Resume with identical `(threadId, interruptId, status, payload)` must be idempotent. Emit `STATE_SNAPSHOT`/`MESSAGES_SNAPSHOT` before the interrupting `RUN_FINISHED`.
- `RUN_ERROR` is the sole error event.
- Package versions at planning time: `@ag-ui/core` 1.0.2 (deps: none; peer zod), `@ag-ui/encoder` 1.0.2 (depends on `@ag-ui/proto`, protobuf — **do not use**), `@ag-ui/client` 1.0.2 (rxjs, uuid, fast-json-patch — client-side only, optional for hosts), `@copilotkit/react-core` 1.79.0 pins `@ag-ui/client` 1.0.2.

## Commands you will need

Run from the repository root with Node 24 (`PATH="$HOME/.local/share/mise/installs/node/24/bin:$PATH"`). These are executor gates, not claims the advisor ran them.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Drift | header command, then open live excerpts | no excerpt mismatch |
| Scaffold | `node --conditions=@rikology/source --import=@poppinss/ts-exec packages/create-pupitre-plugin/bin/create.ts agent --dir packages/pupitre-agent` | exit 0; do **not** pass `--with-ui` (the React component lives in `pupitre-ui`, see Step 4) |
| Package typecheck | `npm run typecheck -w packages/pupitre-agent` | exit 0 |
| Package tests (SQLite) | `npm run quick:test -w packages/pupitre-agent` | all pass |
| Package tests (PG) | `DB=pg DATABASE_URL=postgres://$USER@127.0.0.1:5432/pupitre_agent_test npm run quick:test -w packages/pupitre-agent` | all pass (skip with a recorded reason if no local PG) |
| Core after Step 2 | `npm run typecheck -w packages/pupitre && npm run quick:test -w packages/pupitre` | exit 0; no test depends on the two names being private |
| UI component tests | `npm run test:ct -w packages/pupitre-ui -- --grep AgentChat` | pass |
| Root build/registry | `npm run build && npm run registry:build && npm run registry:check` | exit 0 |
| Exports / i18n / lint | `npm run verify:exports && npm run i18n:check && npm run lint` | exit 0 |
| Example | `npm run typecheck -w apps/example && npm test -w apps/example` | exit 0 |
| Bundle | `cd apps/example && node ace build --ignore-ts-errors && cd ../.. && npm run bundle:budget` | within limits |
| Docs | `npm run check -w apps/docs` | exit 0 |
| Live smoke | start the example per skill `pupitre-example-dev-smoke`; open `/admin/assistant`; send "find posts about pupitre"; confirm a streamed answer and a `search_records` tool chip; trigger a mutating action and confirm the approve/deny card appears before anything changes | observed in browser |

## Scope

**In scope** (the only modifications permitted):

- New `packages/pupitre-agent/**` (server-only): factory, protocol (input parsing + SSE encoding), run loop, server tools, JSON Schema projection, `drivers/openai_compatible.ts`, tests, standard package files, README, CHANGELOG.
- `packages/pupitre/index.ts`: export `executeAction`, `searchResources`, `compileTable`, `applyTableQuery`, `buildTableData`, `aggregateTableSummaries` and the types they need (`TableData`, `TableDataOptions`, `TableSummary`; `TableDescriptor` is already in the catalog) — one commit, additive. `packages/pupitre/CHANGELOG.md` entry. No other core source.
- `packages/pupitre-ui/src/components/AgentChat.tsx` + `AgentChatBody.tsx` (lazy), registration in `packages/pupitre-ui/src/components.ts`, one CT spec, Indonesian messages for new `t()` keys, registry rebuild output.
- Root `package.json` (`workspaces`, `build -w` list) and `package-lock.json`; `eslint.config.js` server-only restrict block; `tools/verify-exports/index.mjs` and `tools/i18n-check/index.mjs` package lists; `.github/workflows/release.yml` target options; `tools/bundle-budget/budgets.json` only if a new named chunk is required by the tool.
- `apps/example`: dependency, `app/admin/agent.ts` (plugin instance with a fake driver when `AGENT_BASE_URL` is unset, real driver when set), registration in `panels/admin.ts`, `.env.example` keys, one integration spec.
- `docs/adr/0030-ag-ui-agent.md`, `apps/docs/src/content/docs/plugins/agent.md`, sidebar entry in `apps/docs/astro.config.ts`, mention in `plugins.md`, a "Beyond Filament" row in `docs/FILAMENT_PARITY.md`, `docs/WIRE_PROTOCOL.md` short section pointing to the plugin page, `plans/README.md` status row.

**Out of scope**: any CopilotKit package in any workspace; `@ag-ui/encoder`/`@ag-ui/proto`/`@ag-ui/client` as dependencies of any Pupitre package; thread/message persistence tables and a `configure.ts`; a panel-wide drawer or shell slot API; changes to `pupitre-transmit`; a hosted LLM proxy or API-key UI; exposing `/_pupitre/agent` outside the session panel group; tool projection for upload/rich-editor/repeater/builder/relationship fields (those actions are simply not exposed); subagent/activity/reasoning events; rate-limit middleware beyond the plugin's own caps.

## Git workflow

- Branch: `advisor/007-ag-ui-agent-plugin`. Record `git status --short` first; do not stash/clean/reset pre-existing work.
- Conventional commits per unit: `docs(adr): adopt AG-UI for the agent plugin`, `feat(core): export action, search and table pipeline primitives`, `feat(agent): AG-UI run endpoint with scoped tools`, `feat(ui): AgentChat component`, `docs(agent): plugin page and CopilotKit client recipe`.
- Do not push or open a PR.

## Steps

### Step 1: ADR-0030 — decisions before code

Create `docs/adr/0030-ag-ui-agent.md` (next free number if occupied). Record this decision table with rationale and rejected alternatives:

| Decision | Default | Rationale |
| --- | --- | --- |
| Protocol | AG-UI 1.0 JSON over SSE; `@ag-ui/core` as the only new runtime dependency (types, `EventType`, `RunAgentInputSchema`, `PROTOCOL_VERSION`) | zero deps, zod peer already present; spec-generated types beat hand-written ones. If `@ag-ui/core` ever adds a runtime dependency, vendor the zod schemas instead |
| Encoder | local `encodeSse(event): string` producing `data: ${JSON.stringify(event)}\n\n` | `@ag-ui/encoder` drags protobuf; SSE framing is ~10 lines |
| Endpoint | `POST /_pupitre/agent` inside `panelRouteGroups(router, panel).tenant()`, route name `agent.run`; `Accept: text/event-stream` required, else 406 | same auth/CSRF/tenancy as every panel JSON route; browser session only |
| Authorization | mandatory `authorize(ctx)` option (fail closed, like media/jobs/health); every tool call additionally re-authorizes through `authorizeResource`/`executeAction` | the agent never widens what the user can already do by hand |
| Driver contract | `AgentDriver.complete({ system, messages, tools, signal }) → AsyncIterable<DriverChunk>` where `DriverChunk = { type: 'text'; delta } \| { type: 'tool_call'; id; name; argumentsJson } \| { type: 'done'; finishReason }` | one LLM turn per call; the plugin owns the tool loop, so the driver stays trivially fakeable in tests |
| Built-in driver | `openAiCompatible({ baseUrl, apiKey, model, headers? })` using global `fetch` and the chat-completions SSE format | covers OpenAI, OpenRouter, Ollama, vLLM without an SDK |
| Server tools (v1) | `search_records(resource?, query)`, `get_record(resource, id)`, `list_records(resource, …table params)`, `run_record_action(resource, id, action, data?)` | first three are pure reads over existing scoped primitives; the fourth is the only mutation path and always interrupts |
| `list_records` contract | one tool per top-level resource with a list page and `viewAny` at request time, named `list_<slug>`; arguments mirror the list URL (`q`, `sort`, `tab`, `groupBy`, `filters.<name>`, `page`) and are projected into JSON Schema from the compiled `TableDescriptor` (not the raw definition), so select options, labels and query-builder operators are exactly what the operator's filter UI offers; executed through `scopedQuery` → `applyTableQuery` → bounded `limit` → `buildTableData` (+ `aggregateTableSummaries` when the table declares summaries); returns `{ total, page, perPage, columns: [{ name, label }], rows: [{ id, url?, cells }], summary?, groups? }` with cells limited to string/number/boolean/null | the agent sees exactly what the operator's list page shows, under the same allowlist validation; aggregation is whatever the table already declares, not free-form SQL |
| Frontend tools | taken from `RunAgentInput.tools`; the plugin emits `TOOL_CALL_*` for them and ends the run with `outcome: success`; the client executes and sends the `tool` message on the next run. The shipped component registers `navigate(url)` | spec-conformant; CopilotKit's `useCopilotAction` works unchanged |
| Confirmation | `run_record_action` never executes in the run that proposed it. The run ends with an interrupt (`reason: 'tool_call'`, `toolCallId`, `message` = action label + record title, `responseSchema: { approved: boolean }`, `expiresAt` = now+10 min). Execution happens only in the resumed run with `payload.approved === true`, re-authorizing on a fresh scoped record | AG-UI interrupt contract; `requiresConfirmation()` is UI-only so the server must own the barrier |
| Pending-interrupt state | kept server-side in an in-memory `Map<threadId, PendingInterrupt[]>` keyed by panel+user+tenant with TTL; a run on a thread with pending interrupts and no `resume` → `RUN_ERROR` | spec rule 4; no persistence in v1. Multi-process hosts lose pending interrupts on restart — documented limitation |
| Idempotency | executed resumes are remembered per `(threadId, interruptId)` until TTL; replay returns the stored `ActionResult` summary without re-running | spec rule 5 |
| Threads/messages | stateless: the client sends full `messages` every run; server never stores them | keeps v1 free of migrations; persistence is a later plan |
| JSON Schema projection | `fieldsToJsonSchema(nodes)` handles text/textarea/number/slider/select/multiSelect/checkbox/checkboxList/radio/toggle/toggleButtons/date/color/tags/hidden; flattens grid/section/wizard; any other kind → the action is **not** exposed as a tool | partial schemas would invite invalid tool calls; omission is honest |
| i18n | tool results and streamed assistant text pass `resolveTranslations(value, locale, messages)`; text sent to the LLM passes `stripTranslationMarkers` | markers are invisible code points that would leak into prompts and SSE |
| Caps | `maxTurns` (tool-loop iterations, default 6), `maxInputMessages` (default 40), `maxInputChars` (default 32 000), per-request `AbortSignal` from `ctx.request.request` close | bound cost and runaway loops; no retries |
| Client dependency policy | `AgentChat` uses `fetch` + `ReadableStream` + `TextDecoder`; no `@ag-ui/client` | one lazy chunk; rxjs stays out of pupitre-ui |
| CopilotKit | documented as a host-side client recipe only (subclass `HttpAgent`, add `credentials: 'same-origin'` and `X-XSRF-TOKEN`) | never a workspace dependency |

Open questions to record with defaults: panel-wide drawer (deferred; needs a shell slot API — note that `ShellProps` has none); thread persistence and audit of agent-initiated actions (host audit adapter already records resource mutations; agent-specific audit deferred); bulk actions via agent (deny in v1); streaming tool-progress for long `handle()` (not in v1); exposing custom-page/widget actions (not in v1); multi-process pending-interrupt store (deferred; note the TTL map boundary); free-form aggregation beyond declared table summaries (deny — would bypass the allowlist model); nested resources in `list_records`/`get_record` (deny in v1: they need a parent-record route context, same reason kanban rejects them).

**Verify**: `test -f docs/adr/0030-ag-ui-agent.md` → exit 0; `npm run lint` → exit 0.

### Step 2: Export the core primitives

In `packages/pupitre/index.ts` add `export { executeAction } from './src/compiler/action_compiler.js'` next to the action exports (around line 175), `export { searchResources } from './src/search/query_service.js'` next to the other query helpers (around line 258), and `export { compileTable } from './src/compiler/table_compiler.js'`, `export { applyTableQuery } from './src/query/table_query.js'`, `export { buildTableData } from './src/table/table_data.js'`, `export { aggregateTableSummaries } from './src/table/table_summary.js'` beside `scopedQuery` (line 26). Re-export the types a caller needs (`TableData`, `TableDataOptions`, `TableSummary`; the `CompileOptions` type of `compileTable` as `TableCompileOptions`; `SearchGroup`/`SearchResult` if not already in the catalog wire types). Add a `## Unreleased` line to `packages/pupitre/CHANGELOG.md`. Do not change signatures or behaviour.

**Verify**: `npm run typecheck -w packages/pupitre && npm run verify:exports` → exit 0.

### Step 3: Create `@rikology/pupitre-agent` (server-only)

Scaffold with the command above, then rename/trim to match `pupitre-kanban` (no `configure.ts`, no stubs, no commands). Register everywhere listed in Scope. Add `@ag-ui/core` as a regular dependency pinned `^1.0.2`; peer `@rikology/pupitre` at the core version that ships Step 2 (bump the floor per the plugin skill).

Files and responsibilities:

- `index.ts` — `agent(options: AgentOptions): PupitrePlugin`. `AgentOptions = { driver: AgentDriver; authorize(ctx): boolean | Promise<boolean>; system?: string | ((ctx) => string); page?: { slug?: string; label?: string; icon?: string; navigationGroup?: string }; tools?: { search?: boolean; get?: boolean; list?: boolean | ((resource: ResourceRuntime) => boolean); actions?: boolean | ((resource, action) => boolean) }; limits?: { maxTurns?; maxInputMessages?; maxInputChars?; maxRows?; interruptTtlMs? } }`. Contributes, exactly like kanban: the widget `defineWidget('agent-chat').component('AgentChat', load).span('full').lazy(false).canView(authorize)`, the page `definePage(slug).title(label).navigation({ label, group }).canAccess(authorize).widgets([widget])`, and `boot` registering the route. The loader returns `{ agentUrl, agentId: panel.id, title, frontendTools: ['navigate'], suggestions?: string[] }` — the component needs no descriptor URL tricks.
- `src/protocol.ts` — `parseRunInput(body)` via `RunAgentInputSchema` from `@ag-ui/core` with the plugin caps applied after parse (reject with 422 JSON before any SSE byte is written); `encodeSse(event)`; `startStream(ctx)` that sets `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, and returns `ctx.response.stream(readable)` backed by a `Readable` the run loop writes to. Verify once in a test that the first event arrives before the run completes (no buffering by Adonis).
- `src/run.ts` — `runAgent({ ctx, input, options, tools, driver })`: emits `RUN_STARTED` with `protocolVersion`, resolves pending interrupts/resume first (execute approved mutations, emit `TOOL_CALL_RESULT` messages, or `RUN_ERROR` on contract violations), then loops: build driver messages (strip markers; include server + frontend tool definitions), stream `TEXT_MESSAGE_*`, on `tool_call` → if server tool: emit `TOOL_CALL_START/ARGS/END`, execute, emit `TOOL_CALL_RESULT`, continue loop; if mutating: emit `MESSAGES_SNAPSHOT`, register interrupt, `RUN_FINISHED` with interrupt outcome, stop; if frontend tool: emit `TOOL_CALL_*`, `RUN_FINISHED` success, stop. Any thrown error → `RUN_ERROR { message, code }` with a generic message (never the stack) and the stream closed. Request abort cancels the driver via `signal`.
- `src/tools/search.ts` — wraps `searchResources(ctx, resourcesFilteredByOption, query)`; result is the `groups` array with `title/details/url` strings resolved through `resolveTranslations`.
- `src/tools/get_record.ts` — resolves the resource by slug from `ctx.pupitre.panel.resources`, `lookupOrNull(() => scopedQuery(ctx, runtime).where(pk, id).first())`, requires `authorizeResource(ctx, runtime, 'view', record)`, returns `{ id, title: recordTitle attribute, url: runtime.urls.view(id), fields }` where `fields` is limited to the resource's `globallySearchable` attributes plus `globalSearchDetails(record)` — never the whole row.
- `src/tools/list.ts` — one tool per eligible resource (`!runtime.parent`, `definition.pages.list`, `definition.table`, `authorizeResource(ctx, runtime, 'viewAny')` at tool-list time). Execution: `scopedQuery(ctx, runtime, { trashed })`, preload dotted relation columns exactly as `export_service.ts:59-65`, `applyTableQuery(query, table, params, { ctx, tabs: definition.pages.list?.tabs })`; map `E_PUPITRE_INVALID_SORT`/`E_PUPITRE_INVALID_QUERY` to a tool result `{ error: 'invalid_query', detail }` (never `RUN_ERROR`, so the model can correct itself once); total via `.clone().clearOrder().count('* as agent_total').pojo().first()`; rows via `.clone().offset((page-1)*perPage).limit(perPage)` where `perPage = min(options.limits.maxRows ?? 25, first declared table choice)` — the agent never asks for `perPage`; `buildTableData(table, records, total, { ctx, locale: ctx.pupitre.locale, timezone: ctx.pupitre.timezone, normalized, rowActions: async () => [], rowUrl: (record) => runtime.urls.view(id) when `pages.view` exists else undefined })`; drop cells that are not string/number/boolean/null (custom/extension/image/component cells); when `table.columns.some(c => c.summaries?.length)`, also `aggregateTableSummaries(queryResult.query, table, { normalized, locale, timezone, ctx })` and attach `summary`/`groups`. Every string passes `resolveTranslations`. Hidden-by-default toggleable columns are included (the model benefits from them; the operator can toggle them too).
- `src/tools/table_schema.ts` — `tableToJsonSchema(descriptor: TableDescriptor, table: TableDefinition): { schema, unsupportedFilters: string[] }` where `descriptor` comes from `compileTable(table, { url: runtime.urls.list, id: `${panel.id}.${slug}`, tabs, bulkActions: [], compileFilterForm: async () => emptySpec })` per request (descriptors are user/locale dependent; never cache across users). Properties: `q` (string, only if any column `searchable`), `sort` (array of enum: each `sortable` column name and its `-` negation, `maxItems: table.multiSort ?? 1`), `tab` (enum of tab keys from `table.tabs`/definition), `groupBy` (enum of group keys), `page` (integer ≥ 1), `filters` object with per-kind properties from `descriptor.filters`: `select` → enum of `options[].value` (array of enum when the definition says `multiple`); `ternary` → boolean; `dateRange` → `{ from?: date, to?: date }` (ISO date strings); `trashed` → enum `with|only|without`; `queryBuilder` → `{ groups: [[{ constraint: enum of `constraints[].name`, operator: enum of that constraint's `operators[].value`, value?, negated?: boolean }]] }` with `maxItems` 8/16 mirroring `parseQueryBuilder`, serialised by the tool to the JSON string `applyTableQuery` expects; `custom` filters and select filters whose descriptor has no `options` → listed in `unsupportedFilters` and omitted (the tool still exists; those filters are simply not reachable by the agent). Each property carries the descriptor `label` as `description` after `stripTranslationMarkers`.
- `src/tools/run_action.ts` — lists row actions of a resource that have `handle` and whose `form` projects fully; builds one tool per `(resource, action)` with name `run_${slug}_${action}`; on resume-approved execution: fresh `scopedQuery` lookup, `authorizeResource(ctx, runtime, 'update', record)` plus the action's own gates inside `executeAction({ ctx, record, data, authorize: (ability, target) => authorizeResource(ctx, runtime, ability, target), currentUrl: runtime.urls.view(id), listUrl: runtime.urls.list })`; return `{ ok: true, flash: [...] }` summary from `ActionResult`. Built-in `actions.delete()`/`edit()` are not exposed in v1 (no `handle`).
- `src/tools/json_schema.ts` — `fieldsToJsonSchema(nodes): { schema, supported: boolean }` per the ADR table; `required` from the field's `required` rule; enum from static select options only (callback/relationship options → unsupported).
- `src/drivers/openai_compatible.ts` — `fetch(baseUrl + '/chat/completions', { stream: true, tools })`, parse SSE lines, yield `DriverChunk`s; assemble tool-call argument deltas by index; propagate `signal`.
- `src/drivers/fake.ts` (exported for hosts' tests and the example) — scripted responses.

Errors: unauthenticated/unauthorized → 403 JSON before streaming; invalid body → 422 JSON; everything after the first SSE byte → `RUN_ERROR`.

**Verify**: `npm run typecheck -w packages/pupitre-agent` → exit 0; `npm run quick:test -w packages/pupitre-agent` → the Test plan cases pass on SQLite; PG run when available.

### Step 4: `AgentChat` component in `pupitre-ui`

`packages/pupitre-ui/src/components/AgentChat.tsx` mirrors `KanbanBoard.tsx` (lazy body + `Suspense` + `role="status"` fallback). `AgentChatBody.tsx`:

- State: `messages` (AG-UI `Message[]` — user/assistant/tool), `streaming` text buffer, `pendingInterrupts`, `threadId` (`crypto.randomUUID()` per mount), `error`.
- Run: `fetch(agentUrl, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'X-XSRF-TOKEN': xsrfToken() }, body: JSON.stringify(runInput), signal })` — use `xsrfToken` from `@rikology/pupitre-react`; parse `data:` frames with `TextDecoder` + line splitting; dispatch on `type`. Handle `TEXT_MESSAGE_*`, `TOOL_CALL_START/ARGS/END/RESULT`, `MESSAGES_SNAPSHOT`, `RUN_FINISHED` (inspect `outcome`), `RUN_ERROR`. Unknown event types are ignored.
- Frontend tool `navigate`: on `TOOL_CALL_END` with that name, parse args, `router.visit(url)` only for same-origin panel URLs, append a `tool` message with the result, and auto-start the next run.
- Interrupt card: for each interrupt render message + Approve/Deny buttons (24px+ targets, visible focus, status text not colour-only per `PRODUCT.md:41`); Approve → resume `{ status: 'resolved', payload: { approved: true } }`, Deny → `{ approved: false }`, Dismiss → `cancelled`.
- Visual language: existing primitives (`Card`/`Button`/tokens); no gradients, no avatars-with-glow; assistant text rendered as plain paragraphs (no markdown dependency in v1 — note in docs).
- Register in `components.ts`; new `t()` keys get Indonesian entries; run `npm run registry:build`.
- CT spec: mock `fetch` with a scripted SSE body; assert streamed text appears incrementally, a tool chip renders, the interrupt card blocks until Approve, and `RUN_ERROR` shows the status message.

**Verify**: `npm run test:ct -w packages/pupitre-ui -- --grep AgentChat` → pass; `npm run registry:build && npm run registry:check` → exit 0.

### Step 5: Example wiring and integration proof

`apps/example/app/admin/agent.ts`: `agent({ driver: env.get('AGENT_BASE_URL') ? openAiCompatible({ baseUrl, apiKey: env.get('AGENT_API_KEY'), model: env.get('AGENT_MODEL') }) : fakeDriver(script), authorize: admin-email gate, page: { slug: 'assistant', label: 'Assistant', icon: 'message-square', navigationGroup: 'Administration' } })`. Add the three env keys to `.env.example` as optional (`env.ts` schema optional strings). Register in `panels/admin.ts`.

`apps/example/tests/agent.spec.ts`: boot the example, log in as the admin user, POST a run with the fake driver scripted to call `search_records`, assert the SSE body contains `RUN_STARTED` with `protocolVersion`, a `TOOL_CALL_RESULT` whose content lists an existing post, and `RUN_FINISHED`; then a scripted `run_posts_publish`-style call must end with an interrupt and must not mutate; a resume with `approved: true` must mutate exactly once and a replayed identical resume must not mutate again.

**Verify**: `npm run typecheck -w apps/example && npm test -w apps/example` → exit 0; live smoke row from the commands table observed.

### Step 6: Docs, parity, gates

`apps/docs/src/content/docs/plugins/agent.md` (frontmatter like kanban): install, options, driver contract with the fake driver example, the tool list and what is deliberately not exposed, the interrupt flow with a sequence diagram, security notes (session-only, fail-closed authorize, every tool re-authorizes, caps), limitations (stateless threads, in-memory interrupts, no markdown), and **"Using CopilotKit as the client"**: `class PupitreAgent extends HttpAgent { requestInit(input) { return { ...super.requestInit(input), credentials: 'same-origin', headers: { ...headers, 'X-XSRF-TOKEN': token } } } }` — verify the override point against installed `@ag-ui/client@1.0.2` in a throwaway directory before documenting; if the hook differs, document the actual one. Add to the sidebar, `plugins.md`, a `docs/WIRE_PROTOCOL.md` pointer, and a "Beyond Filament" row in `docs/FILAMENT_PARITY.md`. Fill README/CHANGELOG of the new package.

Run every gate in the commands table and record actual results in the implementation report.

**Verify**: all gate commands exit 0; `git status --short` shows only Scope files.

## Test plan

`packages/pupitre-agent/tests/agent.spec.ts` boots `createTestApp` with `definePanel('admin').resources([posts]).plugins([agent({ driver: fake, authorize })])` (kanban pattern) and covers, by name:

1. Unauthenticated → 401/redirect per panel guard; authenticated but `authorize` false → 403 JSON, no stream.
2. Missing `Accept: text/event-stream` → 406; invalid `RunAgentInput` → 422 with no SSE bytes.
3. Happy path streams `RUN_STARTED{protocolVersion}`, `TEXT_MESSAGE_START/CONTENT×n/END`, `RUN_FINISHED{outcome.success}`; first frame is received before the driver finishes (buffering guard).
4. `search_records` returns only `viewAny`-authorized, tenant-scoped resources; a denied policy yields an empty group, never 403 mid-stream.
5. `get_record` outside scope → tool result `{ error: 'not_found' }`; without `view` → `{ error: 'forbidden' }`; returned fields are limited to searchable attributes + details.
5a. `list_<slug>` exists only for top-level resources with a list page the user may `viewAny`; a nested resource and a `viewAny`-denied resource produce no tool. Tenant isolation: rows from another tenant never appear even with a `queryBuilder` filter that would match them.
5b. `list_<slug>` honours `tab` (first tab default applied when omitted), `sort` (invalid/unsortable column → `{ error: 'invalid_query' }`, run continues), `q`, `select`/`ternary`/`dateRange`/`trashed` filters, and a `queryBuilder` filter with a negated rule; `page` beyond the end returns `rows: []` with the correct `total`; `perPage` from the model is ignored and the plugin cap applies.
5c. `list_<slug>` cells are the same formatted strings the list page renders (compare against `buildTableData` output for the same rows), object cells are dropped, `url` is present only when the resource has a view page; a table with `summaries` returns `summary` (and `groups` when `groupBy` is set) matching `aggregateTableSummaries`.
5d. `tableToJsonSchema` unit test against a `compileTable` descriptor: enums for sort/tab/groupBy/select, `multiple` select → array, custom filter and option-less select listed in `unsupportedFilters`, queryBuilder constraint/operator enums equal the descriptor's `constraints[].operators[].value`, labels have no marker code points, and the schema is regenerated per request (two users with different `viewAny` sets get different tool lists).
6. `run_*` tool call ends with an interrupt, no mutation, `MESSAGES_SNAPSHOT` precedes `RUN_FINISHED`.
7. Resume approved → exactly one mutation, `TOOL_CALL_RESULT` emitted; replayed identical resume → no second mutation; `approved: false` → no mutation and the assistant receives the denial as a tool result; resume for unknown `interruptId`, partial resume, or run without `resume` while pending → `RUN_ERROR`; expired interrupt → `RUN_ERROR`.
8. Actions whose form contains an unsupported field kind are absent from the tool list; supported fields project `required`/`enum` correctly (unit test of `fieldsToJsonSchema`).
9. Frontend tool call → `TOOL_CALL_*` then `RUN_FINISHED` success without server execution; a frontend tool name colliding with a server tool is rejected at run start with `RUN_ERROR`.
10. `maxTurns` reached → `RUN_ERROR` with `code: 'max_turns'`; driver throw → `RUN_ERROR` with generic message; request abort cancels the driver `signal`.
11. Translation markers: a resource label built with `t()` appears in tool results without `\u{E0001}` code points.
12. `openAiCompatible` driver: against a local `http.createServer` fixture emitting chat-completions SSE, assembles text deltas and multi-chunk tool-call arguments; honours `signal`.

`apps/example/tests/agent.spec.ts` as described in Step 5. `packages/pupitre-ui/tests/ct/agent_chat.spec.tsx` as described in Step 4. Count and name tests in the report.

## Done criteria

All must hold:

- [ ] `docs/adr/0030-ag-ui-agent.md` exists with the decision table, interrupt contract, and open questions.
- [ ] `packages/pupitre/index.ts` exports `executeAction`, `searchResources`, `compileTable`, `applyTableQuery`, `buildTableData`, `aggregateTableSummaries` (+ types); CHANGELOG updated; no other core change.
- [ ] `list_<slug>` tools exist per eligible resource, reuse the table pipeline unchanged (no plugin-side SQL), respect scope/tenancy/tab/filters/sort, cap rows, and return formatted cells; cases 5a–5d pass.
- [ ] `@rikology/pupitre-agent` builds, exports `agent`, `openAiCompatible`, `fakeDriver`, `AgentDriver`/`DriverChunk` types; only `@ag-ui/core` added as a runtime dependency; no `@copilotkit/*`, `@ag-ui/encoder`, `@ag-ui/proto`, `@ag-ui/client`, rxjs, or `ai` anywhere in the lockfile diff.
- [ ] `POST /_pupitre/agent` is registered through `panelRouteGroups(...).tenant()`, named, fail-closed on `authorize`, and every tool re-authorizes through core primitives.
- [ ] Mutations never execute in the proposing run; interrupt/resume behaves per the spec rules tested in cases 6–7.
- [ ] `AgentChat` is registered in the default registry, lazy, passes CT, and `npm run bundle:budget` stays within limits.
- [ ] Example `/admin/assistant` works with the fake driver and, when env is set, with an OpenAI-compatible endpoint (live smoke observed and reported).
- [ ] Docs page, sidebar, parity row, WIRE_PROTOCOL pointer, and the CopilotKit client recipe (verified against `@ag-ui/client` 1.0.x) exist.
- [ ] All gates exit 0; new `t()` keys have Indonesian messages; only Scope files changed.
- [ ] `plans/README.md` row 007 is DONE with gate evidence.

## STOP conditions

Stop and report rather than improvise if:

- A Current state excerpt differs from the live files.
- `@ag-ui/core@1.0.x` turns out to carry a runtime dependency beyond zod, or its `RunAgentInputSchema` is incompatible with the repo's zod major — report; the ADR fallback (vendored schemas) needs explicit approval.
- `ctx.response.stream` buffers the SSE body until completion in the test harness (case 3 fails) and no in-scope header fixes it.
- Executing an approved action safely requires more than `scopedQuery` + `authorizeResource` + `executeAction` (e.g. a core-internal controller path that cannot be reproduced without copying it).
- The spec's pending-interrupt rules cannot be met without persistence (e.g. tests must span processes).
- The example app or docs build needs a CopilotKit package to demonstrate the client recipe — keep the recipe as prose/code block only.
- A gate fails twice after one reasonable in-scope fix, or the bundle budget is exceeded by the lazy chat chunk.

## Maintenance notes

- The endpoint is a browser-session surface, not an API. Resist adding token auth here; that belongs to a separate headless-API direction (`plans/README.md` "Versioned headless JSON API").
- Keep the tool allow-list derived from resource definitions and policies at request time; never cache tool lists across users or tenants.
- When core gains a server-side confirmation barrier for actions, the interrupt path should delegate to it rather than keep a parallel rule.
- Thread persistence, audit of agent-initiated runs, and a panel-wide drawer are the obvious next plans; each needs its own ADR, and the drawer needs a `ShellProps` slot design first.
- `list_records` deliberately exposes only what the table definition declares (filters, sortable columns, summaries). If hosts ask for "ask any question about my data", that is a separate direction (read-only SQL/semantic layer) with its own threat model — do not grow this tool into it.
- Track AG-UI deprecations (`DEPRECATIONS.md` upstream): the 0.x compatibility shims expire ~12 months after 1.0; this plugin emits only 1.0 shapes, so it is unaffected, but pin `@ag-ui/core` to `^1`.
