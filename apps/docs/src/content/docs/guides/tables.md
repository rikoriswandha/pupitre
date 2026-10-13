---
title: Tables
sidebar:
  order: 5
---

The callback argument to `.table((t) => ...)` configures the table. The exported `table` namespace creates columns and filters:

```ts
.table((t) => t
  .columns([
    table.text('title').searchable({ individually: true }).sortable().wrap(),
    table.text('author.name').searchable(),
    table.text('price').money('USD').summarize(['sum', 'avg']),
    table.select('status').options({ draft: 'Draft', published: 'Published' }),
  ])
  .filters([table.filter.select('status').options({ draft: 'Draft', published: 'Published' })])
  .defaultSort('title', 'asc')
  .paginated([10, 25, 50])
  .striped()
)
```

## Columns

| Factory | Use |
| --- | --- |
| `text(name)` | Search/sort, limit/wrap/description, badge, money/numeric, date/dateTime/since, copy, URL/timezone, option labels |
| `badge(name)` | Option labels/colors, search/sort |
| `icon(name)` | Boolean or mapped icons/colors |
| `image(name)` | Circular/stacked images |
| `color(name)` | Color preview |
| `toggle(name)`, `checkbox(name)` | Editable booleans |
| `select(name)` | Editable select with options |
| `textInput(name)` | Editable text with validation |
| `custom(name, component)` | Host registry component for a named column |
| `fragment(component)` | Host component without a named column |

Shared methods vary by column: label, width, alignment and `.toggleable({ hiddenByDefault })` are defined where supported. `t.count('comments')` creates a relation-count column. Dot notation such as `author.name` supports relation display/search. Inline edit uses server PATCH validation and update authorization; client optimistic changes roll back on failure. Do not assume hiding a column secures its underlying value.

`text` and `badge` columns show stored enum values as-is unless you pass `.options({ draft: 'Draft', published: 'Published' })`. They accept the same option shapes as select fields. Badge `colors` stay keyed by the stored value. When a table is grouped by a column that has options, the group headings use those labels too. Search, sort and filters still operate on stored values.

## Filters and tabs

Factories are `table.filter.select(name)`, `.ternary(name)`, `.dateRange(name)`, `.custom(name)`, `.queryBuilder(name)` and `.trashed()`. Select supports options/multiple/attribute; ternary supports true/false labels and attribute; date range supports attribute/timezone; custom filters supply `.form([...]).query(callback)`.

`.filtersLayout('dropdown' | 'above' | 'slideover')` changes placement. `.deferFilters()` sends changes on Apply. List-page `.tabs({...})` adds named query scopes, separate from filters. Search, sort, pagination, tabs, filters and grouping use URL state, so copying a URL shares the current table view rather than a server session snapshot.

### Query builder

Import `qb` and `t` from `@rikology/pupitre`. Register only constraints users should be allowed to query:

```ts
table.filter.queryBuilder('query').label(t('Advanced query')).constraints([
  qb.text('title').label(t('Title')),
  qb.number('price').label(t('Price')),
  qb.date('publishedAt').label(t('Published at')).timezone('Asia/Jakarta'),
  qb.boolean('isFeatured').label(t('Featured')),
  qb.select('status').options({ draft: t('Draft'), published: t('Published') }),
  qb.relationship('comments', 'body').label(t('Comments')),
])
```

Rules in a group are ANDed; groups are ORed. Negating a rule uses `negated: true`. Text supports contains/startsWith/endsWith/equals/blank; numbers support comparisons and inclusive between; dates support before/after/on/between/blank; booleans support true/false; selects support anyOf/noneOf; relationships support has/hasNone/minCount and text operators on the registered related attribute. `.attribute(...)` maps a public constraint name to a server-only attribute. Relationship paths and attributes never come from URL input.

Number constraints accept finite values within JavaScript's safe integer range. Use `qb.number('stock').integer()` for signed 32-bit integer database columns: fractional values and values outside −2,147,483,648…2,147,483,647 return HTTP 400 before SQL. Decimal columns should keep the plain `.number()` constraint. Relationship counts must be nonnegative safe integers.

The URL stores JSON under `filters[query]`, for example:

```json
{"groups":[[{"constraint":"status","operator":"anyOf","value":["published"]},{"constraint":"price","operator":"lessThan","value":100}],[{"constraint":"title","operator":"contains","value":"Guide"}]]}
```

An empty builder removes its URL filter. Limits are 8 groups, 16 rules per group, 64 rules total, 500 characters per scalar string, 50 selected values, and 8,192 UTF-8 bytes of serialized JSON; URL-encoded query JSON is also limited to 8,192 bytes. Malformed or unsupported rules are rejected, not silently ignored. Calendar dates use the constraint timezone (otherwise the effective request timezone, falling back to UTC); date comparisons are converted to UTC boundaries. The entire OR expression stays inside the existing resource, tenant, authorization, tab and soft-delete scopes. Exports and summaries use the same filtered query.

Lucid `@column.date()` attributes remain calendar dates without UTC shifting. Datetime comparisons use half-open UTC ranges from the local day's start to the next local day's start, preserving midnight values and DST days without precision-dependent end-of-day rounding.

Dates with year zero, or local-day bounds that convert to UTC year zero, are rejected before SQL. With `.deferFilters()`, query-builder edits are staged immediately and the table's **Apply** button commits them together with the other filters; no second “Apply query” step is required. Incomplete rules or a query exceeding the URL size limit disable **Apply** and show an accessible explanation, rather than committing an older query. Non-deferred builders retain their own **Apply query** control. The editor loads separately only for tables using a query-builder filter.

### Multiple sort columns

Opt in with `.multiSort(3)` (the default maximum is three). A normal header activation replaces the current sort; Shift-click adds or cycles a sort column. Keyboard users can focus the “Add to sort” button next to a sortable header and press Enter or Space to add/cycle that column without replacing the others. Sort priorities are numbered; “Clear sorting” removes the whole sort, including configured defaults. Only the primary sorted header has `aria-sort`.

```ts
.table((tableConfig) => tableConfig
  .columns([table.text('title').sortable(), table.text('price').sortable()])
  .multiSort(3)
  .defaultSort([
    { column: 'title', direction: 'asc' },
    { column: 'price', direction: 'desc' },
  ])
)
```

Sort priority is encoded left-to-right as `sort=title,-price`. Existing single-column URLs and `.defaultSort('title', 'asc')` remain valid. `sort=` explicitly clears even a configured default. Tables without `.multiSort()` retain single-column sorting.

Ordered defaults must fit the configured `multiSort` limit and cannot repeat a column; invalid builder definitions are rejected before a request runs. Clearing user sorting on a reorderable table still preserves its natural reorder-column order.

Implicit reorder-column ordering is not advertised as a user sort token. The clear-sort toolbar is available only on multi-sort tables; existing single-sort tables do not gain a clear control. Hand-written comma-separated sort URLs and query JSON work with Adonis' comma-enabled query parser.


## Grouping and summaries

```ts
.table((t) => t
  .columns([table.text('status'), table.text('price').numeric()])
  .groups([t.group('status').label('Status').collapsible()])
  .defaultGroup('status')
  .summarize('price', ['sum', 'avg', 'range'])
)
```

Summaries support `sum`, `avg`, `count`, `min`, `max`, `range`. They aggregate the complete filtered query, not just the current page, and can include per-group results. Group selection is URL-backed.

## Behavior and layout

`.query(callback)` customizes the query. `.searchDebounce(milliseconds)` controls search; `.recordUrl(callback | false)` controls row navigation and `.rowClass(callback)` applies safe class tokens. `.emptyState({ heading, ... })` customizes empty feedback (see exact shape in the reference). `.layout.grid({ default, md, xl })` switches to card/grid layout.

`.reorderable('position')` enables drag and keyboard ordering with the reorder ability checked server-side. `.poll('30s')` requests reloads while respecting background tabs, active dialogs and edits. `.deferLoading()` loads table data through deferred Inertia props. Column toggles persist per table in local storage. Default sorting supports a single column or an ordered array; `.multiSort()` enables user-controlled sort priority.

## Export and import

```ts
.actions({ header: [
  actions.export().columns([
    exportColumn('title').label('Title'),
    exportColumn('price').label('Price'),
  ]),
  actions.import(),
] })
```

Import `actions` and `exportColumn` from `@rikology/pupitre`. Exports use the filtered table query and server formatters, writing CSV or XLSX downloads. `exports.maxSyncRows`, `maxAsyncRows` and `retentionMinutes` control limits/retention. With a jobs adapter, large exports have progress and private download endpoints; configure a worker and run `pupitre:prune` for expired files.

Enable Excel with `actions.export().formats(['csv', 'xlsx'])`. CSV is the default;
multiple formats show a picker, while `['xlsx']` downloads Excel directly. Both
sync and queued exports share filtered/tenant-scoped queries, locale-resolved
headers, private downloads and retention. XLSX cells preserve numeric/boolean
formatter results and represent null as empty. Its bold header and one worksheet
are written incrementally into a deflated ZIP, without a shared-string table.
Like CSV, strings beginning with `=`, `+`, `-`, `@`, tab or carriage return receive
a literal single quote; numeric negatives remain numbers. XML-illegal characters
are removed and worksheet names are sanitized/truncated to 31 characters.


All CSV downloads (synchronous exports, queued exports, and failed import rows) protect against spreadsheet formula injection: string cells and headers starting with `=`, `+`, `-`, `@`, tab, or carriage return receive a leading single quote. Numeric values remain numeric, including negative numbers. Importing an exported CSV preserves this quote literally; Pupitre does not strip it automatically.

Import reads CSV headers and maps them to scalar resource form fields. Each row is VineJS-validated with a separate transaction; the result counts created/updated/failed rows and supplies a failed-row CSV. `.resolveRecord(callback)` on `actions.import()` supports upsert; `.async()` enables queued import where configured. Read the [action reference](/reference/api-action/) for resolver and export formatter signatures before writing callbacks.

## Custom-data tables

Table widgets do not require a Lucid model when `records()` is supplied. Custom pages display them with `definePage(...).widgets([widget])`.

```ts
defineWidget('currencies').table(t => t
  .columns([table.text('name').searchable().sortable()])
  .recordKey('code')
  .paginated([10, 25])
  .records(async ({ search, filters, sort, page, perPage, ctx, record }) => {
    return currencyService.list({ search, filters, sort, page, perPage, tenant: ctx.pupitre.tenant })
  })
  .resolveRecord(async (key, ctx) => currencyService.findForTenant(key, ctx.pupitre.tenant))
  .actions({ row: [action('inspect').form([schema.text('name').readOnly()])
    .fillForm(({ record }) => ({ name: record.name }))] })
)
```

`records()` receives `search: string`, validated `filters: Record<string, unknown>`, `sort: { column, direction: 'asc' | 'desc' }[]`, `page: number`, `perPage: number | 'all'`, the HTTP `ctx`, and optional enclosing edit/view `record`. It returns `{ rows: Record<string, unknown>[], total?: number }`. The callback performs filtering/search/sorting itself; SQL is never inferred. Unknown/non-sortable sort keys return 400. Select/ternary/date-range values and custom filter forms are validated before calling the provider.

Search/sort/filter/pagination remain in the URL, prefixed by the widget name (`currencies[q]`, `currencies[sort]`, `currencies[filters][region]`, `currencies[page]`). For counted pagination return `total`. For simple pagination omit `total` and return up to **perPage + 1** rows at offset `(page - 1) * perPage`; the extra row determines whether Next is enabled, but is not displayed. The callback still receives the requested page size, not the incremented size.

`recordKey()` defaults to `id`, which must be a string or number. `resolveRecord(key, ctx)` is mandatory for row/bulk actions; it must enforce tenancy itself and return null for inaccessible keys (404). Submitted row objects are never trusted. `.actions({ row, header, bulk })` uses standard action builders, modal forms, `.can()` host abilities, and JSON execution.

Custom-data tables reject Lucid query callbacks, relation dot notation/counts, summaries, groups, reordering, inline editing, query-builder/trashed filters, SQL custom-filter callbacks, saved views and builtin/export actions at definition time. Regular columns and formatting remain available. The example Store overview includes a searchable, sortable, filtered Currencies widget and an Inspect modal.

## Saved views

Opt in to personal and public saved views with `.savedViews()`. Import `tableView` to define immutable developer presets:

```ts
import { table, tableView } from '@rikology/pupitre'

.table((t) => t
  .savedViews()
  .presetViews([
    tableView('Drafts').icon('file-pen')
      .query({ filters: { status: 'draft' }, sort: '-createdAt' }).default(),
  ])
  .columns([table.text('createdAt').sortable()])
  .filters([table.filter.select('status').options({ draft: 'Draft', published: 'Published' })])
)
```

The **Views** toolbar saves the current filters, search, sort, grouping, page size, tab, individual column searches and visible columns. Users can apply, update, rename or delete their own views, and set or unset a default. Defaults apply only when the URL has no state for that table. Presets are read-only; a user's default takes priority over a preset default. Relation-manager tables use their own query prefix and table identity, preserving unrelated URL parameters.

Run the `pupitre_table_views` host migration published by the configure hook. Views are scoped to panel, tenant and table. Private views are visible only to their owner; public views remain subject to table `viewAny`. Publishing or changing an existing public view requires the explicit resource policy method `managePublicViews(user)`: no policy or missing method denies access. Saved state is validated against the table definition and normalized through the live query pipeline; invalid state returns HTTP 422. Column visibility is stored explicitly in a saved view and overrides the browser's ordinary localStorage preference when applied.

See [Saved table views](./saved-views) for the HTTP and client contracts. Saved views apply to resource and relation-manager tables, not custom-data widgets.


