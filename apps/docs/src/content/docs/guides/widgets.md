---
title: Widgets and dashboards
sidebar:
  order: 7
---

`defineWidget(name, model?)` creates a dashboard or resource-page widget. Stats and charts load data from a server callback; table widgets use the same table compiler as resources.

```ts
import { defineWidget, stat } from '@rikology/pupitre'
import Post from '#models/post'

export default defineWidget('post-overview')
  .heading('Publishing').span(2).sort(10).poll('30s')
  .stats(async ({ ctx, filters }) => {
    const posts = await Post.query().where('status', 'published').count('* as total')
    return [stat('Published posts', Number(posts[0].$extras.total))
      .description('Ready for readers').color('success').chart([3, 5, 8, 13])]
  })
```

Callbacks receive `{ ctx, filters, record? }`. **Write tenant-aware queries in your stats/chart loaders**; an arbitrary model query in a callback does not automatically become a resource-scoped query. `record` is available for widgets placed on edit/view pages.

## Widget kinds

`.stats(callback)` accepts plain stat definitions or `stat(label, value)` builders. Stats support description, description icon, color and sparkline chart values. `.chart(type, callback)` supports line/bar/area/pie/doughnut/radar/scatter; return `{ labels, datasets: [{ label, data, color? }] }` (scatter uses `{ x, y }` points, see below).

For `.table(callback)`, supply a model: `defineWidget('latest-posts', Post).table((t) => t.query(...).columns(...))`. Use the exported `table` namespace for columns. `.component('HostWidget')` renders a registered host component.

Common controls: `.span(number | 'full')`, `.sort(number)`, `.poll(intervalString)`, `.heading(string)`, `.description(string)`, `.canView(callback)`, `.lazy(boolean)`. Defaults are span 1, sort 0 and lazy loading enabled.

Spans count columns of a four-column grid on wide screens (two columns on tablets, one on phones). Widgets fill rows in sort order; a row that would leave empty columns stretches its widgets proportionally, so two `span(1)` charts followed by a `span('full')` table render as two halves rather than two quarters and a hole.

## Radar and scatter charts

Both stay in the lazy Recharts chunk and expose their values in a screen-reader data table.

```ts
defineWidget('capabilities').chart('radar', async ({ ctx }) => ({
  labels: ['Speed', 'Quality', 'Cost'],
  datasets: [{ label: 'Team', data: [8, 9, 6] }],
}))

defineWidget('distribution').chart('scatter', async ({ ctx }) => ({
  datasets: [{ label: 'Products', data: [{ x: 12, y: 40 }, { x: 25, y: 18 }] }],
}))
```

Radar uses the usual numeric `{ labels, datasets }` shape. Scatter has no labels array: each dataset's `data` contains numeric `{ x, y }` points; `color` is optional on either dataset type. Loader types follow the selected chart kind, and catalog validation rejects incompatible shapes. In real loaders, authorize and tenant-scope the underlying queries.

## Placement and filters

Register panel dashboard widgets with `.widgets([...])`, custom-page widgets with `definePage(...).widgets([...])`, or header/footer widgets with `pages.list/create/edit/view().widgets([...]).footerWidgets([...])`.

Panel `.filters([...])` and custom-page `.filters([...])` accept named select filter definitions (see [WidgetFilterDefinition](/reference/api-page-widget/)). Their values are URL-backed and supplied to loaders as `filters`. Each select starts with an "All" option (value `''`, no filter in the URL); give one of your options the value `''` to use your own label for it instead. Deferred Inertia data lets the page shell show before queries finish. Keep expensive queries in loaders, never in builder module initialization.

## Timeline widgets

`.timeline(callback)` accepts `TimelineItem[]` or `Promise<TimelineItem[]>`. The callback receives the same `{ ctx, filters, record? }` context as stats/chart loaders:

```ts
export const history = defineWidget('publication-history')
  .heading('History').span('full')
  .timeline(() => [{
    title: 'Published',
    time: '2026-10-11T09:00:00.000Z',
    description: 'Approved release',
    actor: 'Editorial team',
    icon: 'history',
    color: 'success',
    changes: [{ field: 'status', old: 'draft', new: 'published' }],
  }])
```

The fixed item demonstrates the shape; replace it with your authorized history query. `title` and ISO timestamp `time` are required. `description`, `actor`, `icon`, `color` and `changes` are optional; each change has `field`, `old` and `new`. Server compilation formats the timestamp for the panel timezone. The built-in `Widget.Timeline` component renders the core spec, so no transport/plugin-specific React component is needed.

Attach it to a dashboard/custom page or use `pages.view().footerWidgets([history])`. Scope custom queries to the tenant and apply access checks rather than assuming widget placement authorizes an external history store. The [Audit plugin](/plugins/audit/) automatically appends record timelines to selected existing view/edit pages.

## Component loaders and actions

`.component(name, loader?)` accepts `(args: { ctx, filters, record? }) => unknown | Promise<unknown>`. Its return value reaches the registered React component as **data**, not the `{ kind, data }` transport envelope. Register widget actions with `.actions([action('move').form([...]).can('move').handle(...)])`; form fields use the ordinary Vine validation and JSON action transport. Widget `canView` and enclosing page/resource authorization are checked on every request. A string `.can()` uses the enclosing resource policy, or a host Bouncer ability on custom pages/dashboard widgets. Without `.can()`, any mutation-specific checks belong in the handler.

The action transport accepts `tableAction` only as `row`, `bulk`, or `header`; unknown values return 404 and never switch a widget action from resource-policy authorization to a host ability.

```tsx
import { useWidget } from '@rikology/pupitre-react'

function CalendarWidget({ descriptor, data: initialData }) {
  const { data, errors, loading, reload, runAction } = useWidget(descriptor, initialData)
  async function move(id, start) {
    await runAction('move', { id, start })
    await reload({ start, end: '2026-11-01' })
  }
  // Render your host component using data; errors contains field errors after 422.
}
```

`reload(params?)` returns the loader value and updates local component data. `runAction(name, data?)` returns `ActionResult` including `flash`; it does not automatically reload or navigate. HTTP failures reject `WidgetRequestError` with `status` and `errors`, allowing drag/drop components to roll back. Preserve the supplied descriptor: its data URL binds panel, tenant, custom page or resource page, and record context. Loaders/actions must scope any external data themselves.

Model-free widgets can use `.table(t => t.records(...))`; see [Custom-data tables](/guides/tables/#custom-data-tables).
