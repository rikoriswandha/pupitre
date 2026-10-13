# Plan 001: Document tenant registration and profile as host-owned workflows

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`, unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: From the repository root, run `git diff --stat 4e076fa..HEAD -- docs/FILAMENT_PARITY.md docs/DESIGN.md docs/adr apps/docs/src/content/docs/guides/tenancy.md packages/pupitre/src/definition/tenancy.ts packages/pupitre/src/builder/panel.ts .prettierignore eslint.config.js package.json apps/docs/package.json plans/README.md`. Regardless of the output, compare EVERY "Current state" excerpt against the LIVE files, not only `git diff`: the planning tree already contained substantial uncommitted/untracked plugin, core, UI, example and docs changes. STOP on a mismatch; do not overwrite existing work. The source/config paths are read-only evidence, not permission to edit them.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs/direction
- **Planned at**: commit `4e076fa`, 2026-10-13

## Why this matters

The parity checklist says tenant registration/profile are complete, and the design document advertises a `.tenancy({ registration: TenantForm })` option that the public tenancy definition does not provide. A host developer following that promise cannot configure the advertised workflow. Correct the documentation without introducing a rushed runtime API, and record the authorization and membership requirements a later implementation must address. The existing docs-site guide already correctly assigns tenant registration to the host; preserve it.

## Current state

All excerpts below were read from the live repository while writing this plan. Line markers identify the original locations; edits can shift line numbers.

- `docs/FILAMENT_PARITY.md` is the implementation checklist. Its legend at `docs/FILAMENT_PARITY.md:3` includes: `Status: ⬜ belum, 🟨 sebagian, ✅ selesai.` The affected combined row at `docs/FILAMENT_PARITY.md:21` is:

  ```markdown
  | `->tenant()`, `->tenantRoutePrefix()`, `->tenantMenu()`, `->tenantRegistration()`, `->tenantProfile()` | `.tenancy({...})` + `TenantSwitcher` | M2 | ✅ | URL/implicit mode, membership-aware routing, resource scoping, ownership fill, and global `.scope(false)` |
  ```

- `docs/DESIGN.md` describes intended architecture. The final sentence of `docs/DESIGN.md:432` is:

  ```text
  Yang tetap fitur panel: tenant switcher di sidebar (dari `listForUser`), action "switch tenant" di mode implisit, serta tenant registration/profile page (`.tenancy({ registration: TenantForm })`) seperti Filament, opsional.
  ```

  Change only that sentence, not the earlier resolver/driver description in the same paragraph. Built-in user registration/profile described in the next paragraph are separate features and remain unchanged.

- `packages/pupitre/src/definition/tenancy.ts` is the actual public contract. `packages/pupitre/src/definition/tenancy.ts:18-39` declares the adapter methods `resolve(ctx)`, `scope(query, tenant, options)`, `fill(data, tenant, options)`, `listForUser(ctx)`, optional `switch(ctx, tenantId)`, and optional `run(tenant, next)`. Exact boundary excerpts:

  ```ts
  // packages/pupitre/src/definition/tenancy.ts:33-38
  /** Tenants the user can switch to. */
  listForUser(ctx: HttpContext): Promise<TenantSummary[]>
  /** Implicit mode only: persists the user's current tenant. */
  switch?(ctx: HttpContext, tenantId: string | number): Promise<boolean>
  /** Optional execution context wrapper used by tenant-aware optional peers. */
  run?(tenant: ResolvedTenant, next: () => Promise<void>): Promise<void>
  ```

  `packages/pupitre/src/definition/tenancy.ts:43-61` contains the entire `TenancyDefinition`: `mode`, optional `model`, `ownership`, `slugAttribute`, `titleAttribute`, `menu`, optional `adapter`, optional `tenantsForUser`, and `currentTenantAttribute`. It has no registration/profile or membership-insertion option. Its final fields are:

  ```ts
  // packages/pupitre/src/definition/tenancy.ts:55-60
  /** Custom adapter; defaults to the column driver. */
  adapter?: TenancyAdapter | (() => Promise<TenancyAdapter>)
  /** Default column driver: tenants the user belongs to. */
  tenantsForUser?: (user: LucidRow, ctx: HttpContext) => Promise<readonly LucidRow[]>
  /** Implicit mode: user attribute holding the current tenant id; default `currentTenantId`. */
  currentTenantAttribute: string
  ```

- `packages/pupitre/src/builder/panel.ts:16` derives the accepted options directly:

  ```ts
  export type TenancyInput = Partial<Omit<TenancyDefinition, 'mode'>> & { mode: TenancyMode }
  ```

  `packages/pupitre/src/builder/panel.ts:202-217` checks model/adapter and membership-callback requirements, then stores the tenancy definition with ownership/slug/title/menu/current-tenant defaults and `...options`. It does not create tenant registration/profile pages.

- `apps/docs/src/content/docs/guides/tenancy.md` is the public guide. Its existing `apps/docs/src/content/docs/guides/tenancy.md:32` reads:

  ```text
  `createTenantDriver(definition)` from `@rikology/pupitre/drivers/tenant` integrates `@rikology/adonisjs-tenant`; it still requires a model and membership callback. Tenant billing and a generic tenant-registration workflow are not core features; build host workflows as custom pages/resources with the same authorization boundary.
  ```

  This is not an overclaim. Leave the guide unchanged; do not manufacture a docs-site edit solely to trigger a gate.

- `docs/ARCHITECTURE.md:220` requires the following exact text: ``Query selalu lewat `scopedQuery(ctx, resource)`: callback `.scope(fn)` berjalan terlebih dahulu, lalu default adapter scope; `.scope(false)` sengaja melewati tenancy untuk resource global.`` Authorization occurs before queries and record mutations in that paragraph. A future registration route cannot silently reuse that escape hatch to bypass membership or authorization.

- `docs/adr/0000-template.md:1-16` supplies the ADR structure:

  ```markdown
  # ADR-XXXX: <Judul>

  - Status: Proposed | Accepted | Superseded by ADR-YYYY
  - Tanggal: YYYY-MM-DD

  ## Konteks
  ## Keputusan
  ## Alternatif yang ditolak
  ## Konsekuensi
  ```

  The highest existing ADR filename found during planning is `docs/adr/0026-custom-data-tables.md`. Its exemplar header at `docs/adr/0026-custom-data-tables.md:1-6` is:

  ```markdown
  # ADR-0026: Custom-data tables with server-owned record resolution

  - Status: Accepted
  - Tanggal: 2026-10-13

  ## Konteks
  ```

  Match the template's headings and metadata; English body text is consistent with this exemplar. ADR-0027 is reserved for this plan; other concurrent plans reserve 0028 and 0029. Check that 0027 remains free before creating it.

- Verification/config evidence:
  - `package.json:31-32`: `"lint": "eslint ."`, `"format": "prettier --write ."`.
  - `.prettierignore:6-7`: `docs` and `*.md` are ignored. Do not run the write-mode formatter as a Markdown verification gate.
  - `eslint.config.js:42`: `'docs/**'` is ignored; `eslint.config.js:51,55` scopes explicit language configurations to TSX and TS/TSX. There is no configured Markdown processor here. Root lint is an integration gate, not proof of prose/Markdown correctness.
  - `apps/docs/package.json:9,13`: `"precheck": "node scripts/prepare-content.mjs"` and `"check": "astro check"`. Use the docs check only if an approved revised scope actually edits docs-site content; preparation generates reference content, so inspect and preserve unrelated existing changes.

## Commands you will need

Run from the repository root. Use the existing dependency installation; no install is required for this docs-only change.

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Drift signal | The `git diff --stat` command above, followed by live-file excerpt comparison | No mismatched excerpt; existing user changes preserved |
| ADR inventory | `node --input-type=module -e 'import { readdirSync } from "node:fs"; console.log(readdirSync("docs/adr").filter(n => /^\d{4}-.*\.md$/.test(n)).sort().join("\n"))'` | Existing highest number confirmed; proposed filename/number free |
| Documentation assertions | The Node command in Step 3 | Exit 0; `tenant parity documentation checks passed` |
| Root lint | `npm run lint` | Exit 0 |
| Conditional docs gate | `npm run check -w apps/docs` | Exit 0, no Astro errors; only if docs-site content changes under an approved scope revision |
| Working-tree inventory | `git status --short` | Task delta limited to the in-scope paths; pre-existing unrelated changes preserved |

## Scope

**In scope** (the only files you should modify):
- `docs/FILAMENT_PARITY.md` — the single tenancy row.
- `docs/DESIGN.md` — the final sentence of the tenancy paragraph.
- `docs/adr/0027-tenant-registration-out-of-scope.md` — create the decision record below. If number 0027 is taken, use the next unused number AFTER 0029, retaining the slug, and consistently substitute the number in the title and verification command.
- `plans/README.md` — this plan's status row only, unless the dispatching reviewer maintains it.

**Out of scope**:
- All TypeScript/React/runtime code, public types, routes, drivers, tests, migrations, example pages, membership tables and package manifests.
- `apps/docs/src/content/docs/guides/tenancy.md` — it already makes the conservative claim. No replacement is needed.
- Other parity rows, including built-in user auth registration/profile.
- Broader corrections to DESIGN's resolver/driver wording or other architectural drift.
- Actual tenant registration/profile hooks or prototypes: this plan records prerequisites, not an API implementation.
- Other plans and their reserved ADR numbers 0028/0029.

## Git workflow

- Before any edit, record `git status --short`; never stash, reset, restore or discard the dirty tree to make this plan easier.
- Branch: `advisor/001-tenant-registration-parity` (create with `git switch -c advisor/001-tenant-registration-parity` if absent; switch to it if already present and doing so preserves the working tree). Stop if safe switching is not possible.
- One logical docs commit after the gates pass, only if the operator's execution policy allows commits: `docs: clarify tenant registration and profile ownership`. Stage explicit task paths/hunks, never all dirty files. No source change or generated artifact belongs in that commit.
- Do NOT push or open a PR.

## Steps

### Step 1: Establish live contract and reserve the ADR number

Run the drift command, read all Current state locations, and compare the snippets against live files even when the committed diff is empty. Read the entire live `TenancyDefinition` and `TenancyAdapter`; stop if registration/profile hooks or a membership writer have appeared. Inventory `docs/adr`, confirm the latest existing number, and choose 0027 if free. If occupied, select the next free number after 0029; do not overwrite a record or steal another plan's reservation. Record the chosen path for subsequent steps.

**Verify**: Run the ADR inventory command from the Commands table → sorted filenames, with the chosen number absent before creation. Run `git status --short` → baseline captured without discarding any existing changes. Live excerpts must match; otherwise STOP rather than continuing.

### Step 2: Correct the two claims and write the decision record

Replace the entire tenancy row in `docs/FILAMENT_PARITY.md` with this exact text:

```markdown
| `->tenant()`, `->tenantRoutePrefix()`, `->tenantMenu()`, `->tenantRegistration()`, `->tenantProfile()` | `.tenancy({...})` + `TenantSwitcher` | M2 | 🟨 | URL/implicit mode, membership-aware routing, resource scoping, ownership fill, and global `.scope(false)` are implemented. Tenant registration/profile are not provided; the host builds them as custom pages with explicit authorization and membership persistence. |
```

In `docs/DESIGN.md`, replace only the quoted final sentence of the tenancy paragraph with this exact text:

```text
Yang tetap fitur panel: tenant switcher di sidebar (dari `listForUser`) dan action "switch tenant" di mode implisit. Tenant registration/profile belum disediakan oleh `.tenancy()`; host membangunnya sebagai custom page melalui `definePage`, dengan otorisasi server dan persistence membership eksplisit. Kontrak saat ini tidak memiliki opsi `registration`/`profile` atau operasi adapter untuk membuat membership; hook khusus tersebut memerlukan keputusan API terpisah.
```

Leave the docs-site tenancy guide unchanged because it already describes the host-owned workflow. Do not change `.registration()`/`.profile()` for user accounts.

Create `docs/adr/0027-tenant-registration-out-of-scope.md` with the following exact body (substitute the chosen number if 0027 is occupied):

```markdown
# ADR-0027: Tenant registration and profile remain host-owned

- Status: Accepted
- Tanggal: 2026-10-13

## Konteks

The parity checklist and design document advertised tenant registration/profile through `.tenancy()`, but `TenancyDefinition` has neither option. `TenancyAdapter` resolves, scopes, fills ownership, lists memberships and optionally switches tenant or wraps execution; it has no membership-insertion operation. Built-in user registration/profile are distinct from tenant creation/profile management.

## Keputusan

Keep tenant registration/profile outside the current built-in tenancy API. Hosts build explicitly authorized custom pages with `definePage` and own tenant creation, profile persistence and membership insertion. Correct the parity checklist to partial support rather than claiming completed hooks. This decision adds no public options, routes or adapter methods.

A future hook proposal must decide the following before implementation; these are recommended defaults, not available APIs:

- Page ownership: accept a host-owned `definePage` definition/reference rather than inventing a second form DSL or accepting a React component. Specify discovery, navigation and route-name collisions.
- Registration context: use an authenticated, explicitly authorized route that does not require an existing tenant membership. Specify placement outside the tenant-required route group; do not weaken ordinary membership resolution or use a global resource escape hatch as authorization.
- Membership persistence: define an explicit adapter extension for tenant creation plus membership insertion, with host-provided persistence. Do not reinterpret `fill()` or `listForUser()` as writers. Define actor, validated input, transaction participation and resolved-tenant return types before choosing method names.
- Atomicity: create the tenant and creator membership in one transaction; publish success or switch context only after commit. A failure must leave neither an orphan tenant nor partial membership.
- Authorization: require server-side, fail-closed authorization before displaying or submitting registration and before tenant-profile reads/updates. Bind profile operations to the resolved tenant and verify membership and management permissions; hiding navigation is insufficient.
- Completion: explicitly choose post-create URL/implicit-mode behavior, membership visibility, validation/error handling and duplicate-submit behavior. Never infer a tenant from untrusted form ownership fields.

Open questions for the later proposal are the page-reference type and route placement, the adapter writer/result and transaction contract, capability names, which tenant-profile fields may change, and whether successful creation automatically selects the tenant. No answer is committed by this ADR.

## Alternatif yang ditolak

- Keep complete parity and the undocumented option example — directs hosts to a nonexistent contract.
- Add minimal hooks in this documentation change — creation, membership, routing and authorization semantics have not been designed or tested.
- Treat built-in user registration/profile as tenant registration/profile — conflates account and tenant lifecycle boundaries.

## Konsekuensi

Current integrations and runtime behavior remain unchanged; hosts must implement their own tenant-management workflows. A later implementation plan must include core definition/builder, adapter, routing/controller and host-example changes, with tests for authorization denial, existing-member profile access, cross-tenant rejection, successful creation with membership, transactional rollback, and URL/implicit post-create behavior. Do not restore complete parity until the documented public hooks exist and those tests pass.
```

**Verify**: Run the documentation assertion command in Step 3 immediately after these edits → exit 0. No source implementation or prototype is part of this step.

### Step 3: Check the documentation delta and close the plan

Run this read-only assertion command. If the ADR number changed, replace only the ADR path and title prefix consistently:

```sh
node --input-type=module -e '
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(p, "utf8");
const row = read("docs/FILAMENT_PARITY.md").split("\n").find(l => l.includes("->tenantRegistration()"));
assert(row && row.includes("| M2 | 🟨 |"));
assert(row.includes("Tenant registration/profile are not provided; the host builds them as custom pages with explicit authorization and membership persistence."));
const design = read("docs/DESIGN.md");
assert(!design.includes("registration: TenantForm"));
assert(design.includes("Tenant registration/profile belum disediakan oleh `.tenancy()`"));
assert(design.includes("Kontrak saat ini tidak memiliki opsi `registration`/`profile`"));
const adr = read("docs/adr/0027-tenant-registration-out-of-scope.md");
assert(adr.startsWith("# ADR-0027: Tenant registration and profile remain host-owned\n"));
for (const token of ["- Status: Accepted", "- Tanggal: 2026-10-13", "## Konteks", "## Keputusan", "## Alternatif yang ditolak", "## Konsekuensi", "definePage", "membership insertion", "fail-closed", "one transaction", "Open questions", "recommended defaults, not available APIs"]) assert(adr.includes(token), token);
assert(read("apps/docs/src/content/docs/guides/tenancy.md").includes("Tenant billing and a generic tenant-registration workflow are not core features"));
console.log("tenant parity documentation checks passed");
'
```

Run `npm run lint`. It must pass, but it does not lint the corrected Markdown. Inspect the task diff against the captured dirty-tree baseline, ensuring the unchanged guide and all source files remain untouched. Update only plan 001's index row to DONE (or leave index updates to the reviewer if instructed). Do not run whole-workspace tests/builds for a prose-only change.

**Verify**: Assertion command → `tenant parity documentation checks passed`, exit 0. `npm run lint` → exit 0. `git diff -- docs/FILAMENT_PARITY.md docs/DESIGN.md plans/README.md` and `git status --short` → only intended task hunks plus separately identified pre-existing changes; chosen ADR exists. If the guide requires a change contrary to the live evidence, STOP for a scope revision; an approved docs-site change additionally requires `npm run check -w apps/docs` → exit 0.

## Test plan

- No new runtime tests: no behavior or API changes are allowed. The executable documentation assertions are the regression check for partial parity, removal of the unsupported example, the ADR structure and preserved conservative guide.
- Structural exemplar: `docs/adr/0026-custom-data-tables.md` for metadata and `docs/adr/0000-template.md` for headings, not a Japa test. Core/plugin test fixtures are intentionally irrelevant to this docs-only scope.
- Run the Node assertions and `npm run lint`; both must exit 0. Markdown is ignored by Prettier and is not processed by the root ESLint configuration, so do not claim those tools validate prose.
- `npm run check -w apps/docs` is conditional on an approved docs-site edit; the planned implementation leaves that guide unchanged.

## Done criteria

- [ ] The Node documentation assertion command exits 0 and prints its success line.
- [ ] The tenancy parity row retains the implemented scoping/switcher capabilities but has status 🟨 and explicitly identifies missing tenant registration/profile.
- [ ] `docs/DESIGN.md` no longer contains `registration: TenantForm`; its tenancy paragraph uses the exact replacement above.
- [ ] The chosen `docs/adr/NNNN-tenant-registration-out-of-scope.md` exists, follows the template, records the accepted host-owned boundary and labels future recommendations as unavailable API.
- [ ] The ADR includes creation-form ownership, adapter membership insertion, transaction and fail-closed authorization decisions, open questions and future test requirements.
- [ ] `npm run lint` exits 0; no unsupported Markdown-lint claim is made.
- [ ] No task delta exists outside the in-scope list; all pre-existing unrelated work remains intact. The docs-site tenancy guide and all runtime source files are unchanged by this task.
- [ ] Plan 001's `plans/README.md` row is DONE unless the reviewer explicitly owns index maintenance.

## STOP conditions

Stop and report back (do not improvise) if:

- Any Current state excerpt differs from the LIVE file, including uncommitted/untracked changes invisible to the planned-at committed diff.
- A `registration`/`profile` option already exists in `TenancyDefinition`.
- The live adapter already exposes tenant creation/membership insertion, or the builder already wires tenant registration/profile pages; reassess the finding rather than writing an outdated ADR.
- The tenancy guide now overclaims registration/profile or another source contract contradicts the conservative decision; request a scope revision before editing the docs site.
- The chosen ADR number is occupied and no safe next-free number after 0029 can be established; never overwrite an ADR.
- A verification fails twice after a reasonable in-scope correction, including existing unrelated lint failures; report the actual failing output without fixing other packages.
- The task appears to require a source/API/migration/test change, a different parity row, or any other out-of-scope file.
- Safe branch switching or staging would discard or include another contributor's changes.

## Maintenance notes

- The row groups implemented tenant context with absent lifecycle pages; 🟨 is intentional, not a regression in tenant scoping. The existing M3 checklist introduction says all M1–M3 rows are complete; this change truthfully exposes an unmet lifecycle subset without expanding into milestone-history edits.
- Review tenant versus user registration/profile carefully: user auth APIs remain supported and must not be downgraded.
- Future hooks must be explicitly designed around pre-membership creation routing, authorized tenant-profile access and atomic membership persistence. The ADR's recommendations do not establish callable methods or runtime guarantees.
- A future implementation should replace the deferred boundary with a new/superseding ADR, update both internal and public docs, and restore complete parity only when tests cover both tenancy modes and denial/rollback paths.
- Do not add an independent changelog entry to this narrowly scoped documentation correction; the ADR is the durable decision record.
