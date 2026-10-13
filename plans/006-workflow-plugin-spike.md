# Plan 006: Prove transaction-safe resource transitions in a workflow plugin

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm its expected result before moving on. On a STOP condition, report rather than improvise. When complete, update only this plan's status row in `plans/README.md` unless your dispatcher maintains the index.
>
> **Drift check (run first)**: `git diff --stat 4e076fa..HEAD -- packages/pupitre-workflow package.json package-lock.json apps/example/package.json apps/example/app/admin/resources/order_resource.ts apps/example/app/admin/panels/admin.ts apps/example/app/admin/workflow.ts apps/example/tests docs/adr apps/docs/src/content/docs/plugins/workflow.md docs/FILAMENT_PARITY.md plans/README.md`
> This repository already contains substantial uncommitted and untracked work (including the new jobs/kanban plugins). **Compare every Current state excerpt below with the LIVE files even if that command reports nothing.** HEAD comparison alone cannot detect these changes. STOP on an excerpt mismatch; preserve every unrelated working-tree change. Also inspect the read-only core dependencies cited below before implementation.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/002-plugin-kit-and-scaffolder-profiles.md`; use its kit and server/persistence scaffolder profiles when DONE. If 002 is not DONE, proceed without waiting: hand-roll the persistence/configure/test pieces using `packages/pupitre-jobs` and the current server-only scaffolder pattern. Do not implement 002 yourself.
- **Category**: direction
- **Planned at**: commit `4e076fa`, 2026-10-13

## Why this matters

Orders currently implement status transitions, authorization, and event history separately in row actions, bulk actions, and form hooks. A reusable workflow plugin could centralize transition semantics and eventually approvals without expanding the core renderer. This spike must prove safe server-side state changes and atomic history first; an attractive API without a concurrency guarantee is not a successful outcome. Approval functionality is a concrete design deliverable, not an implemented feature in this spike.

## Current state

All excerpts below were read from the live tree. Ellipses in explanations are not code to copy.

### The example's workflow and history

`apps/example/app/admin/resources/order_resource.ts:26-41` defines the complete vocabulary and badge colors:

```ts
const STATUS_OPTIONS: Record<OrderStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
}
const STATUS_COLORS = {
  pending: 'gray',
  paid: 'primary',
  shipped: 'info',
  delivered: 'success',
  refunded: 'warning',
  cancelled: 'danger',
}
```

`apps/example/app/admin/resources/order_resource.ts:46-65` is the host-owned history writer. It accepts an optional transaction already, but row actions currently omit it:

```ts
async function recordOrderEvent(
  order: Order,
  values: { event: string; note?: string | null; fromStatus?: string | null },
  ctx?: HttpContext,
  trx?: TransactionClientContract
) {
  const user = ctx?.auth.user as User | undefined
  await OrderEvent.create(
    {
      orderId: order.id,
      tenantId: order.tenantId,
      event: values.event,
      note: values.note ?? null,
      actor: user ? (user.fullName ?? user.email) : null,
      fromStatus: values.fromStatus ?? null,
      toStatus: order.status,
    },
    trx ? { client: trx } : undefined
  )
}
```

`apps/example/app/admin/resources/order_resource.ts:67-82` is the action to replace:

```ts
const markShipped = action('mark-shipped')
  .label('Mark shipped')
  .icon('send')
  .color('success')
  .requiresConfirmation()
  .visible(({ record }) => (record as Order).status === 'paid')
  .handle(async ({ record, ctx, notify }) => {
    const order = record as Order
    order.status = 'shipped'
    await order.save()
    await recordOrderEvent(order, { event: 'Marked shipped', fromStatus: 'paid' }, ctx)
    notify?.success(`Order ${order.number} shipped`).send()
  })
  .after(({ refresh }) => {
    refresh.table()
  })
```

`apps/example/app/admin/resources/order_resource.ts:84-96` shows why transitions need an extra ability and a modal schema; retain this action unchanged:

```ts
const refund = action('refund')
  .label('Refund')
  .icon('rotate-ccw')
  .color('danger')
  .can('refund')
  .modalHeading('Refund order')
  .modalDescription('Refunds are recorded in the order history.')
  .modalIcon('rotate-ccw')
  .modalWidth('lg')
  .modalSubmitLabel('Issue refund')
  .visible(({ record }) => ['paid', 'shipped', 'delivered'].includes((record as Order).status))
  .form([
    schema.number('amount').label('Refund amount').required().min(1).prefix('Rp'),
```

`apps/example/app/admin/resources/order_resource.ts:115-129` mutates status and writes reason/details to history:

```ts
  .handle(async ({ record, data, ctx, notify }) => {
    const order = record as Order
    const fromStatus = order.status
    const amount = Number(data?.amount ?? 0)
    order.status = 'refunded'
    await order.save()
    await recordOrderEvent(
      order,
      {
        event: `Refunded Rp ${amount.toLocaleString('id-ID')}`,
        note: String(data?.details || data?.reason || ''),
        fromStatus,
      },
      ctx
    )
```

Other entry points remain deliberately outside the prototype cutover:

- `apps/example/app/admin/resources/order_resource.ts:142-146`: `const paid = ((records ?? []) as Order[]).filter((order) => order.status === 'paid')`, followed by a loop setting `order.status = 'shipped'`, saving, and calling `recordOrderEvent`. Bulk shipping stays unchanged.
- `apps/example/app/admin/resources/order_resource.ts:153-156`: `defineRelationManager(Order, 'events').label('History').icon('clock').readOnly()` (fluent lines in source). Its table reads event/status/actor/note/time.
- `apps/example/app/admin/resources/order_resource.ts:202-215`: `.beforeSave(async (record, data, ctx, trx) => {` records status changes with `trx`; `.afterCreate(async (record, ctx, trx) => {` records `Order placed` with `trx`. Do not double-invoke these hooks from the workflow action.
- `apps/example/app/admin/resources/order_resource.ts:309`: `s.select('status').options(STATUS_OPTIONS).default('pending').required(),` means form edits can still bypass the workflow. This spike is not global enforcement.
- `apps/example/app/admin/resources/order_resource.ts:404-407`: `row: [actions.view(), actions.edit(), markShipped, refund, actions.delete()],` and `bulk: [bulkShip, actions.delete()],` identify the exact caller to remove.
- `apps/example/app/admin/resources/order_resource.ts:422-426`: `view: pages.view().footerWidgets([orderHistoryWidget]),` and `.relations([historyManager])` preserve the existing history surfaces.

`apps/example/app/models/order.ts:7,19-25,38` supplies `OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'refunded' | 'cancelled'`, primary key `id`, `tenantId`, `status: OrderStatus`, and `@hasMany(() => OrderEvent) declare events: HasMany<typeof OrderEvent>`. `apps/example/app/models/order_event.ts:7-17` maps `order_events` with `orderId`, `tenantId`, `event`, `note`, `actor`, `fromStatus`, `toStatus`, and auto-created `createdAt`.

`apps/example/app/policies/order_policy.ts:17-25` makes `update(_user: User)` return `true`, while `refund(user: User)` returns `this.isAdmin(user)`. The prototype's denial tests must use a deny-policy fixture, not assume the example's update policy denies ordinary users.

`apps/example/app/admin/widgets/order_history_widget.ts:17-30` already maps history to a record-aware timeline:

```ts
  .timeline(async ({ record }) => {
    if (!(record instanceof Order)) return []
    const events = await record.related('events').query().orderBy('created_at', 'desc')
    return events.map((event) => ({
      title: event.event,
      time: event.createdAt.toISO()!,
      ...(event.note ? { description: event.note } : {}),
      ...(event.actor ? { actor: event.actor } : {}),
      icon: event.fromStatus ? 'refresh-cw' : 'inbox',
      color: STATUS_COLORS[event.toStatus ?? ''] ?? 'gray',
      ...(event.fromStatus
        ? { changes: [{ field: 'status', old: event.fromStatus, new: event.toStatus }] }
        : {}),
    }))
  })
```

### Existing reusable primitives and the transaction boundary

`packages/pupitre-kanban/index.ts:25-41` has the status primitive and optional business gate:

```ts
export type KanbanOptions = {
  statusColumn: string
  statuses: readonly { value: string; label: string; color?: string }[]
  title: string
  description?: string
  orderColumn?: string
  cardEntries?: readonly { name: string; label: string }[]
  limitPerColumn?: number
  page: { slug: string; label: string; icon?: string; navigationGroup?: string }
}
export type MoveRule = (
  record: LucidRow,
  from: string,
  to: string,
  ctx: HttpContext
) => boolean | Promise<boolean>
export type KanbanPlugin = PupitrePlugin & { canMove(rule: MoveRule): KanbanPlugin }
```

`packages/pupitre-kanban/index.ts:148-160` demonstrates a plugin-owned transaction, scoped reread, PostgreSQL locking, and both authorization layers:

```ts
      await target.model.transaction(async (trx) => {
        const query = scopedQuery(ctx, target)
          .useTransaction(trx)
          .whereIn(options.statusColumn, values)
          .orderBy(target.model.primaryKey, 'asc')
        if (trx.dialect.name === 'postgres') query.forUpdate()
        const rows = await query
        const record = rows.find((row) => String(row.$primaryKeyValue) === String(data.id))
        if (!record) throw new NotFound()
        if (!(await authorizeResource(ctx, target, 'update', record))) throw new Forbidden()
        const row = record as unknown as Record<string, unknown>
        const from = String(row[options.statusColumn])
        if (rule && !(await rule(record, from, to, ctx))) throw new Forbidden()
```

`packages/pupitre-kanban/index.ts:222-224,251` attaches only to the configured resource using `extendResource(candidate)`, `if (candidate.slug !== definition.slug) return`, and returns `{ ...candidate, ...(candidate.form ? { form: amend(candidate.form) } : {}) }`. Preserve host definitions the same way; append generated row actions, never replace the entire action collection.

`packages/pupitre-shield/src/plugin.ts:270-284` also uses `extendResource(resource)` and only returns `{ ...extended, policy: shieldPolicyFor(extended, options) }` when selected and `!extended.policy`. Never overwrite the Order policy. Its action-merging pattern at `packages/pupitre-shield/src/plugin.ts:313-315` is:

```ts
              actions: {
                ...resource.actions,
                row: [...(resource.actions?.row ?? []), ...(relationManager.actions?.row ?? [])],
```

`packages/pupitre/src/definition/plugin.ts:34-39,52-56` documents register → contributions → extendResource → boot, and defines:

```ts
  extendResource?(
    resource: ResourceDefinition<LucidRow>,
    context: PluginResourceContext
  ): ResourceDefinition<LucidRow> | void
  boot?(context: PluginBootContext): void | Promise<void>
```

`packages/pupitre/src/builder/action.ts:32-40,88-103` implements immutable patches: `visible(value)` sets `visible`; `can(value: string)` sets `can`; `requiresConfirmation(value = true)` sets confirmation; `form(value: readonly SchemaNodeBuilder[])` maps `field.toDefinition()`; `handle(value)` and `after(value)` set their callbacks. **`.can()` accepts only an ability string, not a function.** Function guards must execute in the plugin's server handler (and optional visibility wrapper), not be passed to `.can()`.

`packages/pupitre/src/definition/action.ts:25-37` defines handle arguments `record?`, `records?`, `data?`, `ctx?`, `notify?` — **no `trx`**. `packages/pupitre/src/compiler/action_compiler.ts:353-359` checks visibility and action ability before invoking the handler, but these checks use the pre-handler record. At `packages/pupitre/src/compiler/action_compiler.ts:383-384`:

```ts
  const handleContext = { record, records, data, ctx, notify }
  if (action.handle) await action.handle(handleContext)
```

`packages/pupitre/src/http/controllers/action_controller.ts:381-392` passes `ctx`, records, request data, authorization and URLs directly to `executeAction`; it does not supply a transaction. In contrast, `packages/pupitre/src/http/controllers/resource_controller.ts:916-934` opens `target.model.transaction(async (trx) => {`, calls resource save hooks with `trx`, and uses `record.useTransaction(trx)` before save. **A generated `.handle()` cannot borrow the resource-save transaction. The recommended implementation opens its own transaction inside the plugin, as kanban does.** No core API change is needed for this spike.

`packages/pupitre/src/definition/widget.ts:17-25,39` provides:

```ts
export type TimelineItem = {
  title: string
  description?: string
  time: string
  actor?: string
  icon?: string
  color?: string
  changes?: { field: string; old: unknown; new: unknown }[]
}
```

Widget data accepts `{ kind: 'timeline'; items: TimelineItem[] }`. `packages/pupitre/src/adapters/audit.ts:20-26` explicitly says “Hosts own audit capture, storage, retention and redaction. Pupitre only reads it.” Its `forRecord(model, id, options?)` returns `Promise<AuditPage>` with tenant options. Do not invent an audit write API; workflow history writes are separate persistence or a host callback.

### Packaging, tests, and constraints

- `packages/pupitre-kanban/tests/kanban.spec.ts:1-12,42-57` imports Japa and the existing core test helpers, boots `createTestApp` with `definePanel('admin').resources([target]).plugins([plugin])`, truncates fixtures, and creates tenant 1 and tenant 2 records. This is the manager-boot test exemplar; imitate it instead of testing only a standalone helper.
- `packages/pupitre-jobs/configure.ts:5-21` checks whether the migration destination exists, uses `codemods.makeUsingStub(..., 'database/migrations/jobs.stub', {})`, and registers `@rikology/pupitre-jobs/commands`. `packages/pupitre-jobs/stubs/database/migrations/jobs.stub:1-7,14` exports a 13-digit timestamp migration and uses `BaseSchema`, `createTable`, and nullable indexed `tenant_id`. Copy the delivery pattern, not the jobs schema or timestamp.
- `packages/pupitre-jobs/commands/main.ts:3-6,25-26` supplies Ace metadata and resolves `jobs:prune`; use this only if a later design needs a prune command. No retention command implementation is needed now.
- `packages/pupitre-jobs/package.json:35-60` defines source-conditioned exports for root/configure/commands, `typecheck: tsc --noEmit`, `quick:test` through `bin/test.ts`, `test: c8 npm run quick:test`, and copies stub files after compilation. The new package must ship its real migration stub; omit unused command exports.
- `packages/create-pupitre-plugin/bin/create.ts:9-17,24-29` currently accepts `--dir`, `--force`, `--with-ui` and calls `createPlugin`. Do not use `--force` or `--with-ui`. Its source CLI can be run with the same Node source-loader flags used by `packages/create-pupitre-plugin/package.json:48`.
- `apps/example/app/admin/panels/admin.ts:91-107` registers plugins including `ordersKanban` in `.plugins([...])`. Add the workflow instance here; leave kanban unchanged.
- `package.json:10-26` lists workspaces explicitly. `package.json:30-39` defines the typecheck/test/lint/exports/i18n commands below. Root `build` at line 29 explicitly enumerates package workspaces, so append the new package there as well.
- `apps/docs/src/content/docs/plugins/kanban.md:1-6` uses `title` and `description` frontmatter and describes a server-only plugin. Follow that structure for the workflow spike page.
- `docs/FILAMENT_PARITY.md:211` currently reads `| filament-spatie-laravel-translatable, filament-tree/adjacency-list, comments, approvals, Spotlight | — | ⬜ | Belum dikerjakan; permintaan lebih rendah |`. Keep unrelated parity claims intact and label workflow/approvals as a transition prototype, approvals unimplemented — not ✅.
- `docs/adr/0000-template.md:1-16` requires title, Status/date, `Konteks`, `Keputusan`, `Alternatif yang ditolak`, and `Konsekuensi`. Write English content under those template headings. The ADR directory currently ends at 0026; other dispatched plans reserve 0027 and 0028. Use **0029-workflow-transitions.md**, verify it is free immediately before creation, and bump to the next free number if occupied.
- `docs/ARCHITECTURE.md:43-47`: core cannot import React, and official plugins may import core + their peers but not `pupitre-react` (“plugin menyumbang spec, bukan komponen; komponen tambahan lewat registry host”). `docs/ARCHITECTURE.md:243-244`: server never trusts client specs, and authorization remains server-side with 403 rejection. `docs/ARCHITECTURE.md:249`: literal English `t()` keys require Indonesian translations. `docs/ARCHITECTURE.md:253,257`: plugins contribute server specs and extension cannot replace resource slug/model. Maintain snake_case `.ts` filenames, relative `.js` imports, immutable builders, UTC times, and scoped queries.

## Commands you will need

Run from the repository root unless stated otherwise. These commands are executor gates, not claims that the advisor ran them.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Drift | command in header, then open live excerpts | no excerpt mismatch; unrelated dirty files preserved |
| Scaffold (current CLI) | `node --conditions=@rikology/source --import=@poppinss/ts-exec packages/create-pupitre-plugin/bin/create.ts workflow --dir packages/pupitre-workflow` | exit 0; only absent destination created; adapt to 002's documented persistence profile if available |
| Package typecheck | `npm run typecheck -w packages/pupitre-workflow` | exit 0 |
| Prototype tests | `npm test -w packages/pupitre-workflow` | all workflow tests pass |
| Fast prototype test | `npm run quick:test -w packages/pupitre-workflow -- --files=tests/workflow.spec.ts` | all tests in that file pass |
| Root typecheck | `npm run typecheck` | exit 0 |
| Example typecheck | `npm run typecheck -w apps/example` | exit 0 |
| Example tests | `npm test -w apps/example` | all tests pass |
| Exports | `npm run verify:exports` | exit 0 |
| Translations | `npm run i18n:check` | exit 0, all literal keys have Indonesian translations |
| Lint | `npm run lint` | exit 0 |
| Docs | `npm run check -w apps/docs` | exit 0 |

If adding the workspace requires lockfile reconciliation, use the host's established npm workspace procedure, modifying only root `package-lock.json`. Never install inside the new package or migrate the user's development database. Use the tests' isolated database setup.

## Scope

**In scope** (the only modifications permitted):

- New `packages/pupitre-workflow/**`: root factory/types, transition service, history model, configure hook + transition migration stub, tests/fixtures, existing scaffolder-standard package/tsconfig/tsdown/bin/README/CHANGELOG files. No approval implementation.
- Root `package.json` and `package-lock.json`: register/link/build the workspace only.
- `apps/example/package.json`: local workflow dependency only.
- `apps/example/app/admin/workflow.ts` (new): Order workflow registration and transactional host history callback.
- `apps/example/app/admin/panels/admin.ts`: import/register this instance.
- `apps/example/app/admin/resources/order_resource.ts`: remove `markShipped` declaration and its row action entry only; keep all other actions, hooks, history manager, forms, and widget unchanged.
- `apps/example/tests/workflow.spec.ts` (new integration regression test; match host test placement if its existing convention nests tests).
- `docs/adr/0029-workflow-transitions.md` (or next free number), `apps/docs/src/content/docs/plugins/workflow.md`, `docs/FILAMENT_PARITY.md`, `plans/README.md` (this status row only).

**Out of scope**: all core source changes, UI/React/catalog changes, kanban/shield/jobs source changes, 002's implementation, approval persistence/actions, bulk cutover, refund cutover, automatic interception of arbitrary Order saves, replacing existing OrderEvent tables, schema regeneration, development DB writes, runtime dump/log files, and unrelated uncommitted work. An approval API must not become a silently accepted no-op.

## Git workflow

- Branch: `advisor/006-workflow-plugin-spike`. Capture initial `git status --short` to distinguish existing work; do not stash/restore/clean/reset it. If the branch switch is unsafe in the dirty tree, STOP and request a safe executor worktree.
- Conventional commits for logical units, e.g. `docs(workflow): record transition and approval design` and `feat(workflow): prove atomic resource transitions`. Stage only this plan's changes; do not stage whole directories containing pre-existing work.
- Do not push or open a PR.

## Steps

### Step 1: Record the API and explicit decisions before implementation

Create the ADR following `docs/adr/0000-template.md`. Resolve each decision below and retain rationale, rejected alternatives, open questions, and the transaction boundary evidence. Default to this proposal (the outer resource map is an object, not an array):

```ts
workflow({
  resources: {
    orders: {
      column: 'status',
      states: {
        pending: { label: 'Pending', color: 'gray' },
        paid: { label: 'Paid', color: 'primary' },
        shipped: { label: 'Shipped', color: 'info' },
        delivered: { label: 'Delivered', color: 'success' },
        refunded: { label: 'Refunded', color: 'warning' },
        cancelled: { label: 'Cancelled', color: 'danger' },
      },
      transitions: [{
        name: 'ship', from: ['paid'], to: 'shipped',
        label: 'Mark shipped', icon: 'send', color: 'success',
        requiresConfirmation: true,
        // can?: ability string or async server predicate
        // form?: readonly SchemaNodeBuilder[]
        // approval?: { approvers: ability string or predicate, minApprovals?: number }
      }],
      // Omit history for plugin table persistence; 'events-table' explicitly selects it.
      history: 'events-table',
    },
  },
})
```

| Decision | Recommended default | Rationale / implementation boundary |
| --- | --- | --- |
| Resource/column naming | resource slug map; column is Lucid attribute | matches Order `orders`/`status`; resolve physical SQL column through Lucid metadata rather than assuming camelCase is SQL |
| State metadata | map of stable state keys to label/color | exactly matches existing options/colors; no new UI type |
| Transition identity | `name: 'ship'`, generated action `workflow-ship` | valid kebab action name; reject collision with host actions, never override |
| Transition form | existing schema builders; validated by core action form compiler | refund proves need; never accept schema/spec from request |
| Authorization | always resource `update`, plus optional string ability or async predicate | `.can('update')` covers early gate; inside trx independently reauthorize update and extra rule against fresh record; extra guard cannot weaken update |
| Visibility | source-state predicate for UX only | early server visible check is insufficient for races; transaction guards remain authoritative |
| Transaction owner | generated handler opens `runtime.model.transaction` | `.handle()` has no trx; no assumed controller wrapping or core change |
| Stale request definition | fresh scoped reread must be in `from`; compare it with the handler's initial observed status | rejects state changes between controller lookup and transaction; browser-old state which returns to identical source is not detected without a version token, a documented limitation |
| Race protection | PostgreSQL scoped row `forUpdate`; additionally compare-and-set status in write using primary key + expected source and check exactly one affected row | reread alone is not sufficient; CAS protects SQLite and detects competing writers; map attributes to physical columns and keep tenant scope |
| History | default `pupitre_workflow_transitions`; `history: 'events-table'` means this plugin table, not automatic host relation discovery | preserve tenant/panel/resource identity; host callback option permits OrderEvent compatibility |
| Host callback | `history: { record(ctx, change) }`, where `change` includes fresh record, resource, transition, from, to, validated data, actor/tenant identity and mandatory `trx` | callback must return an awaited Promise and use the supplied client; no independent transaction |
| Hooks | explicit workflow hook after history in same trx; default none | do not call resource form mutate/save hooks with incomplete data; transactional hooks receive trx and must not emit network side effects |
| Timeline | reuse `TimelineItem` and a server timeline footer widget for default storage | attach view/edit footer specs only, preserve existing footer widgets; callback mode uses existing host timeline or documented host read callback, never pretends callback storage is queryable |
| Approvals (design only) | new `pupitre_workflow_approvals` migration stub in future implementation; state unchanged until threshold | no fake approval behavior in prototype; reject configured `approval` with a clear unsupported error |
| Error semantics | unauthorized 403; no scoped record 404; invalid/stale source 422 | core visibility can already return 403 for an invalid source; integration tests allow 403/422 for that path, but service stale rejection must be deterministic 422 |
| Release claim | experimental transition spike, approvals not implemented | parity row and docs must not claim full workflow enforcement or approvals parity |

Specify the proposed approval table now in the ADR: UUID request ID, panel/resource/record identity, tenant identity, transition, expected source/target, requester, validated form payload, status (`pending`, `approved`, `rejected`, `stale`), required count, UTC timestamps. Recommend a separate votes table with a unique `(request_id, approver_id)` key rather than mutable JSON votes. Both tables are tenant scoped. Request/approve/reject operations reauthorize on the fresh record; reject terminates pending state; threshold completion locks the request and record, reruns guards, then updates state + history atomically once. No approval row or migration is installed by this spike; the ADR gives the later migration-stub design and explicit deferred files.

Open questions, with defaults to record: own-request approval (deny); distinct approvers (required); cross-tenant approval (deny, including global user roles without tenant access); approval policy changes during pending (reauthorize on every vote and completion); bulk transitions (defer; future per-record authorization, explicit all-or-nothing choice); pending source changes (mark stale rather than force target); sensitive payload retention (minimize/redact, host-owned retention); kanban integration (recommend future MoveRule delegation to workflow service **and execution through it**, not a guard-only delegation that bypasses history). Do not modify kanban now. Determine whether a future browser-visible version token is required for ABA changes; record lack of full snapshot staleness detection now.

**Verify**: `test -f docs/adr/0029-workflow-transitions.md` (substitute chosen free number) → exit 0; `npm run lint` → exit 0. ADR contains the decisions table, approval schema, open questions, and explicit prototype/full-feature boundary.

### Step 2: Create the server-only persistence package

Read 002 if present and DONE, use its kit + server/persistence profile. Otherwise run the current source scaffolder command above against the absent destination and hand-roll configure/migration/test plumbing from jobs. Change package identity to `@rikology/pupitre-workflow`; register root workspace/build and example dependency. Keep source-conditioned exports and compiled export paths aligned; ship `configure` and the migration stub, no unused command entry. Use public core exports only.

Create concrete files `index.ts`, `src/transition.ts`, `src/transition_history.ts`, `src/errors.ts`, `configure.ts`, `stubs/database/migrations/workflow.stub`, `tests/workflow.spec.ts` and fixture setup. Use new 13-digit migration timestamp consistent between configure destination and stub. Default history table columns: UUID id, panel id, resource slug, record id string, nullable tenant id string, transition name, from/to state, nullable actor id/label, nullable note, UTC created timestamp; add scoped identity/time index. No generic user/model FK assumptions. Test stub output and configure idempotence in isolated fixtures.

Reject invalid transitions at factory/boot: unknown states, empty from list, duplicate transition/action names, unresolved resource, unsupported approval, unsafe column mapping, nested resource without parent context. Isolate runtime state per panel, not one global slug map. Publish a real API with tests, not empty stubs; docs page may be brief but must accurately describe implemented behavior.

**Verify**: `npm run typecheck -w packages/pupitre-workflow` and `npm run verify:exports` → both exit 0; `npm run quick:test -w packages/pupitre-workflow -- --files=tests/workflow.spec.ts` → declaration/configure tests pass.

### Step 3: Prove atomic transition execution and history

Implement generated row actions through `extendResource` using immutable action builders and preserving action collections. Resolve the runtime resource in the current `ctx.pupitre.panel`; never trust request resource/tenant/target-state identifiers. Use only the fixed transition definition's `to` state. Generate form/confirmation/labels and `.after(({ refresh }) => refresh.table())`. Early `.can('update')` is mandatory; extra string ability and predicates run again inside trx.

Execution order: capture the initial loaded record's id/status → open plugin-owned trx → scoped lookup by id using trx (PostgreSQL row lock) → confirm live source equals initial source and belongs to allowed `from` → authorize fresh `update` + extra ability/predicate → conditional scoped state write matching expected source → require affected rows === 1 → reload/synchronize fresh model on trx → write exactly one default history row or await the host callback using the same trx → invoke explicit transactional workflow hooks → commit → enqueue success notification/refresh only after commit. A callback/hook failure must roll back state and history. No unawaited writes or fresh non-trx queries in callbacks; SQLite has a single connection held by the transaction.

Expose only the minimal tested server execution entry necessary for the spike tests and later kanban integration. Follow the kit if supplied; do not add a new generic orchestration framework. Test PostgreSQL lock behavior only on the repository's isolated PG setup when available; never claim concurrency proof based solely on a SQLite in-memory sequential test. If no reliable concurrency test is possible within these constraints, STOP before marking the plan DONE rather than remove the guarantee.

For default history, generate a footer timeline on view/edit using scoped history reads and `TimelineItem`. Check record view/update authorization before history disclosure, include panel/resource/tenant/id in lookup, and preserve existing footer widgets. In callback mode do not add a blank plugin timeline; the host's existing widget remains the read side. Audit `forRecord` is an optional read source for a later design, not the write mechanism.

**Verify**: `npm test -w packages/pupitre-workflow` → allowed/invalid/stale/auth/tenant/rollback/concurrency/history/widget tests all pass; `npm run typecheck` → exit 0.

### Step 4: Replace only the Order shipping row action

Create `apps/example/app/admin/workflow.ts` with the six Order states and one `ship: paid → shipped` transition, confirmation, and the existing label/icon/color. Use callback history mode: write `OrderEvent.create` with `orderId`, fresh `tenantId`, event `Marked shipped`, actor from authenticated user, `fromStatus`, `toStatus` and `{ client: change.trx }`. Do not import the default resource into this file (avoid discovery/import cycles); configure by slug. Register the instance in `admin.ts`.

Remove the `markShipped` constant and its row-action caller from `order_resource.ts`. Keep `recordOrderEvent` because refund, bulkShip, beforeSave and afterCreate still use it; keep refund byte-for-byte unchanged. Existing history manager and Order timeline must show the single callback event. The prototype does not prevent status edits in forms or bulkShip/kanban writes; document that explicitly, not as a completed clean global cutover.

Add the host regression test for generated shipping, exactly one OrderEvent, preserved refund action, and retained history footer/manager. Match existing app test boot/auth/tenant conventions. Do not modify OrderPolicy to manufacture a denial; use plugin fixtures for authorization-denial tests.

**Verify**: `npm run typecheck -w apps/example` and `npm test -w apps/example` → both exit 0; source search for `const markShipped`/row `markShipped` in `order_resource.ts` → no matches; refund and bulkShip remain.

### Step 5: Publish the spike limits and run the full gates

Write `apps/docs/src/content/docs/plugins/workflow.md` with frontmatter, prototype API, configure/migration instructions for default storage, Order callback example, transaction boundary, stale semantics, and approval non-support. Update the new package README/CHANGELOG and the parity table honestly: split approvals out if needed, retain all other categories and their current status, and state transition prototype only; approvals remain incomplete. Link the ADR and deferred decisions. Do not add a documentation TODO masquerading as an implemented feature.

Run all required gates and record actual results. If a gate fails due to unrelated existing work, report the precise failure and do not change unrelated source; follow the STOP rules. Update this row in `plans/README.md` only when all criteria hold.

**Verify**: `npm run typecheck`; `npm test -w packages/pupitre-workflow`; `npm run typecheck -w apps/example`; `npm test -w apps/example`; `npm run verify:exports`; `npm run i18n:check`; `npm run lint`; `npm run check -w apps/docs` → all exit 0. `git status --short` → task additions/changes are in Scope; unrelated baseline changes remain untouched.

## Test plan

Use `packages/pupitre-kanban/tests/kanban.spec.ts` as the manager-boot pattern, with `createTestApp`, policy helpers, isolated DB setup/teardown, and two-tenant records. New `packages/pupitre-workflow/tests/workflow.spec.ts` must cover named cases:

1. Allowed transition persists target + exactly one default history row with actor/from/to/panel/tenant.
2. Generated action is present without overwriting host row/header/bulk actions; confirmation/form metadata are preserved.
3. Invalid source is refused (HTTP 403 or 422), no mutation/history.
4. Fresh state differing from initially loaded state is rejected 422, no mutation/history.
5. `update` denial and optional ability/predicate denial each return 403; extra permit never bypasses update denial.
6. Other tenant/scoped-out record returns 404; no leaked history or mutation; two panels sharing a slug do not share configuration/storage lookup.
7. Callback history uses supplied trx; callback and transactional hook failures roll back the state and all history writes.
8. Concurrent competing transitions on the same source yield one success and exactly one history row; losing operation has a deterministic stale/conflict outcome. Exercise real isolated PostgreSQL when available; SQLite busy contention may be explicit rejection, never silent success or a duplicate history event.
9. Default timeline reads scoped history and matches `TimelineItem`; callback mode preserves the host timeline without attaching an empty one.
10. Configure produces a valid migration once; package exports resolve; invalid configuration/approval/collision/nested resources fail clearly.

New `apps/example/tests/workflow.spec.ts` must prove generated shipping replaces only the old row action, produces one OrderEvent visible in existing history, and leaves refund available with its custom ability/form. Count and name the tests in the implementation report, not an assumed number here.

Verification: `npm test -w packages/pupitre-workflow` and `npm test -w apps/example` → all tests pass. Scoped PG concurrency evidence is required for claiming PostgreSQL locking is proven; otherwise report the missing prerequisite and keep status BLOCKED.

## Done criteria

All must hold:

- [ ] `docs/adr/0029-workflow-transitions.md` (or recorded next-free filename) exists following the ADR template; includes the decision table, exact transaction ownership, approval table/vote design, open questions, and deferred scope.
- [ ] `packages/pupitre-workflow/package.json` names `@rikology/pupitre-workflow`, exports root/configure, belongs to root workspaces/build, and ships the transition migration stub.
- [ ] `tests/workflow.spec.ts` boots the manager; the named security/tenancy/stale/rollback/concurrency tests exist and pass.
- [ ] Generated `workflow-ship` works on the example Order and creates exactly one transactional OrderEvent; old `markShipped` declaration/caller are absent; refund/bulk/form hooks remain intentionally unchanged.
- [ ] Default history table persistence and view/edit timeline work; callback mode remains compatible with the existing Order history surfaces.
- [ ] Approval configuration is explicitly rejected by the prototype; no fake approvals tables/actions/API claim.
- [ ] Docs page and package docs exist and distinguish transition prototype from full approvals/global enforcement; parity row retains incomplete approvals status.
- [ ] All Step 5 required commands exit 0; isolated concurrency evidence covers the claimed dialects.
- [ ] New English `t()` keys have Indonesian messages; no React/client imports in the server package.
- [ ] Only Scope files are modified by this task; pre-existing dirty work is preserved; no development DB mutations.
- [ ] `plans/README.md` this row is DONE (or dispatcher maintains it with the gate evidence).

## STOP conditions

Stop and report rather than improvise if:

- A Current state excerpt differs from live files, even when `git diff 4e076fa..HEAD` is empty.
- You attempt to rely on `.handle({ trx })` or controller transaction wrapping: the current handle contract has no trx. Own the transaction inside the plugin; if safe composition requires a core action API change, STOP because core source is out of scope.
- The scoped query cannot use the same trx, policy/callback/hook reads escape onto another client, or a nested transaction is required. SQLite pool deadlocks are evidence of an invalid transaction boundary, not a reason to remove atomic history.
- Fresh reread is treated as sufficient without lock/CAS, conditional writes cannot guarantee one winner, or model attribute-to-physical-column mapping cannot be resolved through public APIs. Do not ship an optimistic race disguised as a guard.
- Approval completion semantics or transition hooks require real external side effects inside the transaction. Record the design blocker; do not add retries/jobs/outbox scope silently.
- You cannot obtain reliable isolated concurrency evidence or cannot preserve both state and history on callback failure.
- A requested target is nested without parent-scoped context, default history leaks panel/tenant boundaries, or missing policies are made permissive.
- Implementing the prototype requires changing kanban, refund, arbitrary form writes, UI/core, or another plan's files.
- A gate fails twice after one reasonable in-scope fix, package resolution needs unrelated workspace repair, or the requested branch cannot safely preserve the dirty tree.

## Maintenance notes

- This is a transition design/prototype, not a complete approval product or global state machine. Existing form, bulk, refund and kanban paths intentionally remain outside enforcement; call that out in reviews and documentation.
- Review transaction client propagation, scoped CAS conditions, lock order, duplicate history, actor/tenant data retention, and plugin reuse across panels especially carefully. Never derive authorized tenant identity from submitted data.
- Future approvals need migration delivery, distinct-voter enforcement, requester restriction, reauthorization, and exactly-once threshold completion before changing parity status.
- Future kanban integration should share both guards and transactional execution; a MoveRule-only check cannot guarantee history consistency. Bulk migration and browser snapshot/version tokens (including ABA detection) require separate accepted design work.
- Keep the host callback's write contract separate from audit's read-only `forRecord` adapter. Keep timeline data in the existing contract rather than adding a dedicated client component.
