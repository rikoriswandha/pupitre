# Changelog

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
