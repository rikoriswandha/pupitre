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
| `text(name)` | Search/sort, limit/wrap/description, badge, money/numeric, date/dateTime/since, copy, URL/timezone |
| `badge(name)` | Labels/colors, search/sort |
| `icon(name)` | Boolean or mapped icons/colors |
| `image(name)` | Circular/stacked images |
| `color(name)` | Color preview |
| `toggle(name)`, `checkbox(name)` | Editable booleans |
| `select(name)` | Editable select with options |
| `textInput(name)` | Editable text with validation |
| `custom(name, component)` | Host registry component for a named column |
| `fragment(component)` | Host component without a named column |

Shared methods vary by column: label, width, alignment and `.toggleable({ hiddenByDefault })` are defined where supported. `t.count('comments')` creates a relation-count column. Dot notation such as `author.name` supports relation display/search. Inline edit uses server PATCH validation and update authorization; client optimistic changes roll back on failure. Do not assume hiding a column secures its underlying value.

## Filters and tabs

Factories are `table.filter.select(name)`, `.ternary(name)`, `.dateRange(name)`, `.custom(name)` and `.trashed()`. Select supports options/multiple/attribute; ternary supports true/false labels and attribute; date range supports attribute/timezone; custom filters supply `.form([...]).query(callback)`.

`.filtersLayout('dropdown' | 'above' | 'slideover')` changes placement. `.deferFilters()` sends changes on Apply. List-page `.tabs({...})` adds named query scopes, separate from filters. Search, sort, pagination, tabs, filters and grouping use URL state, so copying a URL shares the current table view rather than a server session snapshot.

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

`.reorderable('position')` enables drag and keyboard ordering with the reorder ability checked server-side. `.poll('30s')` requests reloads while respecting background tabs, active dialogs and edits. `.deferLoading()` loads table data through deferred Inertia props. Column toggles persist per table in local storage. Single default sort is supported; multi-sort is intentionally not exposed.

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

Import `actions` and `exportColumn` from `@rikology/pupitre`. Exports use the filtered table query and server formatters, writing private CSV downloads. `exports.maxSyncRows`, `maxAsyncRows` and `retentionMinutes` control limits/retention. With a jobs adapter, large exports have progress and private download endpoints; configure a worker and run `pupitre:prune` for expired files.

Import reads CSV headers and maps them to scalar resource form fields. Each row is VineJS-validated with a separate transaction; the result counts created/updated/failed rows and supplies a failed-row CSV. `.resolveRecord(callback)` on `actions.import()` supports upsert; `.async()` enables queued import where configured. Read the [action reference](/reference/api-action/) for resolver and export formatter signatures before writing callbacks.
