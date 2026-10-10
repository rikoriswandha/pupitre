# Changelog

## Unreleased (0.1.0-beta, milestone M1)

### Added

- Builders: `definePanel` (path, guard, middleware, resources, brand, theme, timezone, breadcrumbs), `defineResource` with model-typed form/infolist schema, table, actions, pages and lifecycle hooks (`fill`, `mutateBeforeCreate/Save`, `before/after Create/Save/Delete`, `create`/`update` overrides; hooks receive the Lucid transaction after `ctx`), `schema` (inputs, layouts, repeater, file upload, rich editor, infolist entries), `table` (text/badge/icon/image/color/custom/fragment columns; select/ternary/dateRange/custom filters), `action`/`actions` (create/edit/view/delete/bulk), `pages`.
- `@rikology/pupitre/catalog`: zod-only component catalog, wire-protocol schemas (`pageProps`, `actionDescriptor`, `actionResult`, `tableDescriptor`, `tableData`, …), `dynamic()`/`raw()` expression helpers, fixtures and `assertRegistryComplete`.
- Compilers: schema → json-render spec with closure lifting (expressions/`$computed`, static fallback, `E_PUPITRE_UNLIFTABLE_CLOSURE`), record/user-independent spec cache, VineJS validator (one `vine.compile` per definition, nested repeater paths, model-aware `unique`, upload key ownership, disabled/hidden dehydration), table query/descriptor/data with server-side formatting, action descriptors/forms/execution.
- HTTP runtime: per-panel routes (`<panel>.<slug>.<page>`), Inertia page props with top-level `data` for tables, JSON `ActionResult` protocol for actions, Bouncer mapping (fail-closed when a policy exists without Bouncer), uploads (`/_pupitre/upload` with MIME sniffing, size limits, session ownership, cleanup of replaced files), HTML sanitization.
- `node ace configure @rikology/pupitre` / `pupitre:install`, `pupitre:routes`, `indexAdmin()` discovery hook.
