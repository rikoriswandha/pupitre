---
title: Calendar
description: Authorized, tenant-scoped event calendars and publication scheduling.
---

`@rikology/pupitre-calendar` is a server-only plugin. Its lazy `Calendar` UI is included in `@rikology/pupitre-ui`'s components registry.

## Resource calendar

```ts
import { definePage } from '@rikology/pupitre'
import { calendar, calendarWidget, resourceEvents } from '@rikology/pupitre-calendar'
import PostResource from './resources/post_resource.js'

const publications = calendarWidget('publications')
  .heading('Publication calendar')
  .events(resourceEvents(PostResource, {
    start: 'published_at',
    title: 'title',
    color: '#2563eb',
  }))
  .views(['month', 'week', 'day', 'list'])
  .initialView('month')
  .firstDayOfWeek(1)

const plugin = calendar({
  pages: [definePage('calendar').title('Calendar').widgets([publications])],
})
// Add plugin to your panel's .plugins([...]).
```

The resource must be registered in the panel. Start/end/title mappings accept model attribute names or physical column names. Nested resources require parent context and are deliberately rejected by this helper. Optional `end` enables overlapping multi-day events. Color can also be a callback receiving the scoped record.

Every read authorizes `viewAny` before a scoped query. Event URLs require `view`, and edit URLs additionally require `update`. Every move resolves the record through the same tenant scope and authorizes `update` again; foreign-tenant IDs return 404. Date errors return 422. Resource moves update mapped timestamps directly, like inline table editing; resource form hooks are not invoked.

## Custom events

Custom `.events(loader)` receives `{ start, end, ctx, filters }` and returns events. For example, use an authorized appointments service as the loader and configure `.editable({ can: canMoveAppointment, move: rescheduleAppointment })` using the service's permission predicate and persistence handler. The move callback receives `{ id, start, end, allDay, ctx }`; it runs only after date validation.

Custom loaders own their data authorization. The optional `can` predicate is evaluated when events are loaded and again before custom moves. The move callback must always authorize its own scoped record. `CalendarEvent` accepts `id`, `title`, ISO `start`, optional exclusive `end`, `allDay`, `color`, and `url`. Supply same-origin URLs; never construct event URLs from untrusted redirect targets.

## Interaction and timezone

Month, week/day time grids, and agenda views include Today/Previous/Next controls. Phones default to agenda when enabled. Range changes use `useWidget().reload({ start, end })`; moves use the validated `reschedule` widget action. Drag events to a date/time cell, or use the keyboard-accessible Move dialog. Rejected moves restore the previous event and keep the dialog open.

ISO timestamps retain their instant and render in the effective user/panel timezone. Local move fields are parsed in that timezone and stored in UTC. DST gaps are rejected; ambiguous times select the earlier offset. All-day date-only values remain calendar dates. Colors supplement, never replace, event titles.

Widgets can be used on any `definePage(...).widgets([...])` page. `.description()`, `.span()`, `.sort()`, `.lazy()`, `.poll()`, and `.canView()` follow core widget conventions. No migration, provider, or additional client package is required.
