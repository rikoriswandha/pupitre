# Changelog

## Unreleased (1.0.0, milestone M4)

### Changed
- Catalog (M4): `Repeater` and `Builder` accept the common field props; the schema compiler now emits `name`, `label`, `helperText`, `hint`, `required` and `columnSpan` for repeaters, as it already did for builders.
- Actions (M4): confirmation descriptors default the submit label to the action label ("Delete", "Restore") instead of "Confirm", and destructive confirmations carry a default "This action cannot be undone." description. `confirmation.description` is now forwarded. Camel-case built-in labels are split into words ("Force Delete", not "ForceDelete").

### Added
- Shield (WP37): official `@rikology/pupitre-shield` plugin with Lucid roles/permissions, grouped role-management forms, request-cached Bouncer policies, super-admin bypass, explicit-policy preservation, custom action and nested resource grants, `shield:sync`, User-role assignment helper and custom-page access helper.
- Shield review (M4): hidden relationship fields skip preload authorization/options queries using the current request context; Shield inventories are panel-local and include related-model custom abilities only for enforced resources.
- Documentation (WP41): English Astro/Starlight site for pupitre.dev with M1–M3 guides, plugin authoring, Filament API migration, source-generated TypeScript references and package changelogs; static output publishes the generated shadcn registry index and payloads.
- Plugin generators (WP36): `make:plugin <name>` creates an idempotent local plugin; `--force` overwrites, while `--package [--dir]` executes the standalone scaffolder pinned to the core major without a shell.
- Registry (WP40): `pupitre:ui add` validates names and runs shadcn@4. Explicit root-relative file targets preserve the Inertia source tree; unsafe flattening `--path` passthrough is removed. Hook item names use kebab-case. Real CLI smoke type-checks copied Select and its dependency closure.
- Plugins (WP36): `definePlugin({ name, register, resources, pages, widgets, middleware, navigation, extendResource, boot })` and panel `.plugins([...])`. Plugins apply in declaration order at boot: `register(panel)` returns a new immutable panel builder, contributions are appended to the panel's own entries, `extendResource()` runs for every (nested) resource, and `boot({ app, manager, panel })` runs before routes are registered. Plugin navigation merges into explicit panel navigation by group label, or follows the derived navigation and claims the resources it references.
- Audit (WP38): optional `audit` adapter configuration and lazy `drivers/audit` reader over audit-trail, configurable model discriminators, normalized changes and pagination; timeline widgets format timestamps in the panel/user timezone and require record view authorization even on edit pages.
- Read-only activity resources omit mutation routes and implicit Delete actions. Text-column/text-entry URLs support authorized asynchronous subject links, with request context passed through table rendering. Audit timestamps handle the peer's real SQLite ISO storage and UTC-normalized filter bounds.
- Realtime (WP39): optional lazy `RealtimeAdapter`, boot initialization, URI-encoded user/resource channels, tenant-scoped table subscriptions, authenticated shared client metadata, and best-effort post-commit mutation/inbox pings (including queued imports and bulk actions). Existing polling remains available without a realtime client.
- Realtime review (M4): namespace wire pings as `pupitre:notification` / `pupitre:table`, notify every enabled panel's user channel, and share authorization patterns plus panel guard resolution with transport plugins.
- Audit review (M4): remove unused `recent`/`AuditFilters` contract; custom adapters serve record timelines while Activity queries the audit-trail model.
- Import/export lifecycle records persist canonical string tenant identifiers, keeping queued worker ownership checks consistent across SQLite and PostgreSQL.
- Security audit (WP42): enumerate all example mutating routes for missing/invalid XSRF rejection, enforce explicit 403 CSRF responses, disable browser Zod JIT probes under strict CSP, and publish the 1.x private disclosure policy.
- Restrict UI installer registry URLs and validate component names before network access; block sensitive paths, symlinks and recognizable embedded credentials from registry publication.
- Release performance audit (WP42): enforce measured gzip/Brotli budgets and lazy heavy-feature boundaries after the example CI build; load the example Transmit client only for an enabled realtime driver.
- Packaging audit (WP42): verify every built runtime import uses a declared dependency/peer and resolves under ESM conditions; validate all seven package tarballs and release assets, and exclude configure-test `tmp` declarations from the core build.
- Harden MIME validation and bounded tempfile buffering for resource/plugin uploads, avatars and CSV imports; apply default ceilings and serve CSV attachments with nosniff.
- Throttle sensitive panel and example-host authentication endpoints with bounded local fallback or installed shared limiter, propagating limiter backend failures instead of bypassing protection.
- Bind synthetic queued HttpContext into the Bouncer container resolver so injected authorization policies work in production jobs.
- Login and passkey-options quotas: the IP-wide auth budget is 60/minute (it counts successful sign-ins, so shared IPs are not locked out) while the per-email failure window stays at 5/minute and clears on success.
- Nested resources reused by a parent's relation manager (or reached outside nested routes) no longer fail with `.where expects value to be defined`: the nested scope constrains `:parentId` only when the route carries it.
- Release 1.0 (WP42): `@rikology/pupitre`, `-react` and `-ui` move lockstep to `1.0.0`; official plugins and `create-pupitre-plugin` start at `1.0.0`; inter-package peer ranges are `^1.0.0`; `catalogVersion` is `1.0` (clients on a different major reload once); npm dist-tag `latest` via the new `release.yml` trusted-publishing workflow.
- Final confirmation remediation: nested child scopes now fail closed outside an explicitly bound parent; owning relation managers bind that parent without leaking global-search or relationship-option rows.
- Preserve preloaded options for client-reactive visibility while still skipping server-hidden relationship authorization and queries.
- Align passkey login verification and social callbacks with the 60/minute shared-IP sign-in budget; evict the oldest local limiter key at the 10,000-key cap rather than locking out every new identity.
- Initialize browser CSP jitless configuration before every catalog schema module and probe the built catalog in a fresh process during `verify:exports`; retain repeated-success login and version-derived scaffolder regressions.
- Widgets: stats widgets span the full dashboard row by default (Filament `StatsOverviewWidget` parity); an explicit `.span()` before or after `.stats()` still wins.
- Passkeys: deleting your own passkey from the profile no longer fails with "`limit` has no effect on a `delete` statement". The ownership lookup and the delete now use separate query builders.
- Option labels: `table.text()`/`table.badge()` columns and `textEntry`/`badgeEntry` entries accept `.options(...)` (same shapes as select options) and display the label of the stored enum value instead of the raw value (`Published`, not `published`). Array values map item by item, badge colors stay keyed by the raw value, and table group headings use the options of the same-named column. `resource` scaffolding emits the options for enum columns. `BadgeEntryBuilder` is exported and types `colors()`.

## Unreleased (0.3.0-beta, milestone M3)

### Added
- Widgets (WP27): added immutable widget definitions, dashboard/custom/resource-page widget grids, deferred props, an authorized widget endpoint, and `make:widget` generation.
- Testing (WP34): completed `@rikology/pupitre/testing` with controller-backed Japa resource/custom-page visits, VineJS form submission assertions, and action execution; added package integration and example functional coverage.
- Relations (WP28): added `.relations()`/`defineRelationManager()` with grouped hasMany/manyToMany table/form tabs, tenant/parent scoping, authorization fallbacks, attach/detach/associate/dissociate and related CRUD actions; nested resources, record sub-navigation, `pages.list().modals()`, and `make:relation-manager`.
- Social login (WP32b): panel `.social()` provider configuration, lazy Ally loading, guest redirect/callback, verified-email matching/registration, and MFA-aware completion.
- Import/export (WP30): added `actions.export()`/`actions.import()` CSV actions, immutable `exportColumn()` formatting, prefix-aware filtered exports, schema-derived header mapping (including Skip), per-row VineJS validation/upsert transactions and failed-row CSVs. Added `maxSyncRows` hand-off, chunked scoped export jobs, boot-registered serializable import/bulk/export handlers, nested parent authorization/ownership, `pupitre_exports` progress/download lifecycle, private storage, notifications and pruning.
- MfaPasskeys (WP32a): added the `completeLogin` MFA continuation seam, panel `.mfa()`/`.passkeys()` configuration, TOTP enrollment/challenge with single-use recovery codes, profile security UI, and passkey registration/management plus usernameless login; WebAuthn assertions consume one-time challenges and update credential counters/last-use timestamps.
- Theme (WP33): added validated `defineTheme()` definitions and panel theme compilation for font, density, colors, sidebar modes, content width, and safe stylesheet/font URLs; `indexAdmin()` now discovers theme files.
- Table interaction (WP29b): added immutable inline-edit columns with Vine validation and scoped PATCH transactions, scoped reorder endpoints, polling, persisted column toggles, responsive card layout, and deferred filter application.
- Timezone (WP35): date/time parsing now respects effective component/user/panel timezone, rejects DST gaps, selects the earlier overlap offset, and keeps native datetime inputs independent of the browser zone.
- Editors (WP26b): added MarkdownEditor and CodeEditor schema builders, image editor metadata, sanitized server-side Markdown rendering for TextEntry, and Vine string validation.
- TableData (WP29a): added filtered-query summaries, group results, relation counts, per-column search, safe row classes, manual soft-delete scoping/actions, and deferred list data; resolved deferred response validation and now serialize column summary/image metadata.
- Action extras (WP32c): action deep links, per-user/IP action rate limits, modal footer actions and submit/cancel visibility, and action-bearing flash/database notifications.
- Server evaluation (WP31): added server-backed `afterStateUpdated` form closures, guarded tenant-scoped evaluation endpoint, and complete `pupitre:inspect` closure/index diagnostics.
- WizardBuilder (WP26a): added immutable `s.builder()` typed block schemas, per-block Vine validation and form wizard steps with server-error step mapping.
- SchemaParity (M1–M3): added masked/tel/URL text validation, textarea autosize and field hint actions, bounded `s.slider()`, transactionally synchronized `hasMany` repeaters, and related-model policy checks for Select validation.
- SchemaParity/WizardBuilder (M3): apply builder field validation, metadata, defaults, and visibility; share schema traversal across wizard steps, builder blocks, and repeaters, and preserve explicit nested item bindings and form-field actions.

### Changed
- Wire protocol: `catalogVersion` is now `0.3` (new catalog components, descriptor fields, page props and endpoints listed above); packages released lockstep as `0.3.0-beta`. New optional peers: `@adonisjs/ally`, `@adonisjs/queue`, `@simplewebauthn/server`, `otplib`, `qrcode`.
- Authorization: Pupitre authenticates through `ctx.auth.authenticateUsing([panelGuard])`, so Bouncer policies see the panel user without relying on the host's silent-auth middleware; a policy that defines an ability method is final (fallbacks such as `replicate → create` apply only when the method is missing).
- Widgets/TableData (WP27/WP29a): preserve resource/custom-page context with pagination-safe widget refresh URLs, require explicit record-page context, and recheck nested parent/page access; normalize SQL group keys through Lucid attribute serialization, merge colliding groups with weighted averages, and correlate relation summary expressions so filtered-set totals survive pagination.
- MfaPasskeys (WP32a): bound MFA guesses atomically per actual user primary key across renewed password-login sessions, recovery-code regeneration and MFA disable; retain a fail-closed in-memory budget without an available optional limiter, and consume recovery codes under a transactional row lock.
- WizardBuilder (WP26a): retain owning-resource metadata and full nested upload paths during block validation, persist transformed block output and propagate validation backend errors; match uploads and nested image entries by full schema path and resolve typed block `.data` paths consistently for persisted files and cleanup.
- Import/export/Table interaction (WP30/WP29b): remove ordering from export counts, use primary-key batch tiebreakers and tolerate queued result-count drift; persist setup failures, keep completed exports downloadable after notification failures, and respect explicit reorder denials.
- Relations/Security (WP28/WP30): require record view permission and server-side visibility for custom relation actions, resolve bulk selections through parent/tenant scopes with per-record authorization, preserve explicit policy denials, skip ownership columns for tenant-less unregistered related models, and re-check nested parent access in queued bulk workers.
- Server evaluation (WP31): accept incomplete form state containing empty strings and nulls without rejecting unrelated fields.
- Auth (WP32): clear the login-attempt window after valid credentials while retaining failed-password and MFA throttles.
- MfaPasskeys/SocialLogin (WP32): cap MFA continuation at five failed attempts, preserve MFA enforcement for passkeys without verified user verification, expose enrollment routes without `.profile()`, and publish social identity migration with query-free callback redirects.
- Widgets (WP27): table widgets now run model-backed table queries through the compiler, prefix-aware query parser, and shared server formatter; custom pages accept `.widgets()` and `.filters()`.
- Widgets/TableData (WP27/WP29a): calculate summaries in SQL over scoped, filtered queries; support grouped summaries without loading all matching rows. Widget registries accept lazy barrel objects, widget descriptors expose their GET data endpoint, and generated table widgets bind a model.
- Testing (WP34): isolate fixture rows in integration tests, represent deferred props in helper contexts, and resolve notification inbox database access from the active request app instead of a cached app binding.
- Security (M3): enforce record and relation authorization, tenant-scope unregistered related models, preserve soft-delete hooks for relation deletes, and make panel-guard users visible to Bouncer policies.
- Action extras (WP32c): resolve record-page header deep links independently of record row actions while preserving scoped record authorization.
- Table interaction (WP29b): reorder requests accept a page-window offset so moving page-two rows preserves preceding global positions.

## Unreleased (0.2.0-beta, milestone M2)

### Added

- Panel builder: `.login()`, `.registration()`, `.passwordReset()`, `.emailVerification()`, `.profile({ avatar })` (`.login(false)` keeps host auth), `.navigation([...])` with the new `nav.group()/nav.item()` builders (sort, badge closures, visibility, collapsible groups, external links), `.userMenu([...])`, `.domain()`, `.theme({ primary, darkMode, radius, vars })`, `.tenancy({ mode: 'url' | 'implicit', ... })`, `.notifications({ interval })`, `.globalSearch({ keyBinding } | false)`, `.pages([...])`.
- Auth (WP17): spec-based login/logout, forgot/reset password (`pupitre_password_resets`, SHA-256 one-time tokens per guard with TTL, `pupitre:prune`), optional registration and signed email verification gate, profile (name/email/password with current-password check, avatar via the storage adapter), login/reset throttling through `@adonisjs/limiter` when configured. `MailAdapter` + `@rikology/pupitre/drivers/mail` over `@adonisjs/mail`. Migration stubs published by `configure`.
- Navigation & panels (WP18): permission-filtered nav (`viewAny`, page `canAccess`), boot-time validation of nav slugs, multi-panel support, `make:panel`.
- Authorization (WP19): full Bouncer mapping incl. `authorizeModel()` for related models, self-handled `E_PUPITRE_FORBIDDEN` (JSON 403 / Inertia redirect back + flash), `pupitre:inspect [--json]` reporting missing policies/abilities.
- Tenancy (WP20): `TenancyAdapter`, default `tenant_id` column driver, `@rikology/pupitre/drivers/tenant` over `@rikology/adonisjs-tenant`, tenant-prefixed routes (mode `url`) or user current tenant (mode `implicit`), switch endpoint, automatic ownership fill, resource `.scope(false)`; every resource query goes through `scopedQuery()`.
- Notifications (WP21): `NotificationsAdapter`, `@rikology/pupitre/drivers/notifications` over `@rikology/adonisjs-notifications`, `/_pupitre/notifications` (+ `/read`), `notify.*().sendToDatabase(user?)`.
- Global search (WP22): resource `.globallySearchable([...])` / `.globalSearchDetails()`, `GET /_pupitre/search` (parallel, 5 authorized results per resource, tenant/policy scoped).
- Custom pages (WP23): `definePage()` (path, form, fill/save, actions, `component()` escape hatch), page discovery in `indexAdmin()`, `make:page`.
- `make:resource` (WP24): Lucid model introspection (columns, types, enum meta, relations) or `--from-migration`.
- Dynamic options (WP25): select `options(closure)` (with `values` for validation/label resolution), `relationship(name, title, scope?)`, `searchable()`, `preload()`, `createOptionForm()`/`createOptionUsing()`, `prefixAction()`/`suffixAction()`; `GET/POST /_pupitre/options/:resource/:field`; server-side validation of submitted option values.

### Changed

- Wire protocol: `pupitre.panel` gains `profileUrl`, `userMenu`, `search`; `pupitre.tenant`/`tenants` (`TenantOption`), `pupitre.notifications` (`{ unread, url, readUrl, interval }`), `navGroup.collapsed`, `brand.logoDark`; new response schemas for search, notifications and options. `catalogVersion` is now `0.2`.
- `page.key` includes the tenant id; spec cache keys include the request-bound panel path.

## Unreleased (0.1.0-beta, milestone M1)

### Added

- Builders: `definePanel` (path, guard, middleware, resources, brand, theme, timezone, breadcrumbs), `defineResource` with model-typed form/infolist schema, table, actions, pages and lifecycle hooks (`fill`, `mutateBeforeCreate/Save`, `before/after Create/Save/Delete`, `create`/`update` overrides; hooks receive the Lucid transaction after `ctx`), `schema` (inputs, layouts, repeater, file upload, rich editor, infolist entries), `table` (text/badge/icon/image/color/custom/fragment columns; select/ternary/dateRange/custom filters), `action`/`actions` (create/edit/view/delete/bulk), `pages`.
- `@rikology/pupitre/catalog`: zod-only component catalog, wire-protocol schemas (`pageProps`, `actionDescriptor`, `actionResult`, `tableDescriptor`, `tableData`, …), `dynamic()`/`raw()` expression helpers, fixtures and `assertRegistryComplete`.
- Compilers: schema → json-render spec with closure lifting (expressions/`$computed`, static fallback, `E_PUPITRE_UNLIFTABLE_CLOSURE`), record/user-independent spec cache, VineJS validator (one `vine.compile` per definition, nested repeater paths, model-aware `unique`, upload key ownership, disabled/hidden dehydration), table query/descriptor/data with server-side formatting, action descriptors/forms/execution.
- HTTP runtime: per-panel routes (`<panel>.<slug>.<page>`), Inertia page props with top-level `data` for tables, JSON `ActionResult` protocol for actions, Bouncer mapping (fail-closed when a policy exists without Bouncer), uploads (`/_pupitre/upload` with MIME sniffing, size limits, session ownership, cleanup of replaced files), HTML sanitization.
- `node ace configure @rikology/pupitre` / `pupitre:install`, `pupitre:routes`, `indexAdmin()` discovery hook.
