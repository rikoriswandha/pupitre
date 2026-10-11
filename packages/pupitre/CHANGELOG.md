# Changelog

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
