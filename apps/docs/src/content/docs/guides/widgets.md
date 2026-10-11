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

`.stats(callback)` accepts plain stat definitions or `stat(label, value)` builders. Stats support description, description icon, color and sparkline chart values. `.chart(type, callback)` supports line/bar/area/pie/doughnut; return `{ labels, datasets: [{ label, data, color? }] }`. Radar and scatter are not built-in chart kinds.

For `.table(callback)`, supply a model: `defineWidget('latest-posts', Post).table((t) => t.query(...).columns(...))`. Use the exported `table` namespace for columns. `.component('HostWidget')` renders a registered host component.

Common controls: `.span(number | 'full')`, `.sort(number)`, `.poll(intervalString)`, `.heading(string)`, `.description(string)`, `.canView(callback)`, `.lazy(boolean)`. Defaults are span 1, sort 0 and lazy loading enabled.

## Placement and filters

Register panel dashboard widgets with `.widgets([...])`, custom-page widgets with `definePage(...).widgets([...])`, or header/footer widgets with `pages.list/create/edit/view().widgets([...]).footerWidgets([...])`.

Panel `.filters([...])` and custom-page `.filters([...])` accept named select filter definitions (see [WidgetFilterDefinition](/reference/api-page-widget/)). Their values are URL-backed and supplied to loaders as `filters`. Deferred Inertia data lets the page shell show before queries finish. Keep expensive queries in loaders, never in builder module initialization.

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
