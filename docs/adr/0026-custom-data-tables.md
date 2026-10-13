# ADR-0026: Custom-data tables with server-owned record resolution

- Status: Accepted
- Tanggal: 2026-10-13

## Konteks

Widgets and custom pages need tables over HTTP-free datasets, external services, and aggregates that are not Lucid models. They must retain URL-backed state (ADR-0004), ordinary column formatting and JSON actions (ADR-0012), without fabricating model instances or trusting row objects submitted by a browser.

## Keputusan

Table schemas expose immutable `records(callback)`, `recordKey(name)` (default `id`), and `resolveRecord(key, ctx)` methods. The provider receives authorized HTTP context, optional enclosing record, search, validated filter values, declared sortable columns/directions, page and requested page size. It owns data selection and tenancy. It returns plain rows plus an optional count. With no count, the provider fetches up to `perPage + 1` rows at offset `(page - 1) * perPage`; the server removes the extra row and emits `meta.simple`/`hasNext`. Existing numeric metadata remains a lower bound for wire compatibility and is not displayed as a count. Row/bulk action keys are resolved individually through `resolveRecord` before execution; missing/inaccessible rows return 404. Widget visibility, enclosing page/resource access and action abilities are rechecked for data/form/action requests.

## Alternatif yang ditolak

- Fake Lucid models — hides data-source contracts and introduces model-only behavior into plain rows.
- Browser-owned rows for actions — permits forged records and bypasses tenant selection.
- Browser-only table state — loses shareability and back-button behavior.
- Always require a count — external providers may efficiently paginate without aggregate count queries.
- Infer SQL operations on external rows — ambiguous and unsafe; the declared provider executes filtering/sorting itself.

## Konsekuensi

Custom data reuses the regular table descriptor, formatter, URL prefixes, modal/action transport and visual renderer. A resolver is required when row/bulk actions exist and is responsible for tenant isolation. Definitions reject query callbacks, relation columns/counts, summaries, groups, reorderable/inline-edit columns, SQL custom filters, query-builder/trashed filters, saved views and builtin/export actions. Tests cover provider arguments, invalid sort/filter requests, counted/simple pagination, authorization-before-loading, tenant-aware action resolution and definition order independence.
