# @rikology/pupitre-calendar

Server-only calendar widgets for Pupitre with month, week, day and agenda views, tenant-scoped resource events, policy-aware links, and authorized rescheduling.

```ts
import { definePage } from '@rikology/pupitre'
import { calendar, calendarWidget, resourceEvents } from '@rikology/pupitre-calendar'
import PostResource from './resources/post_resource.js'

const widget = calendarWidget('publications')
  .heading('Publication calendar')
  .events(resourceEvents(PostResource, { start: 'published_at', title: 'title' }))
  .views(['month', 'week', 'day', 'list'])
  .firstDayOfWeek(1)

const plugin = calendar({ pages: [definePage('calendar').widgets([widget])] })
```

Register the resource and plugin in the panel. `pupitre-ui` includes the lazy `Calendar` component in its standard registry. No database migrations or provider are required.

Custom `.events(({start,end,ctx,filters}) => events)` loaders return `CalendarEvent[]`. `.editable({move,can?})` enables moves; the handler receives `{id,start,end?,allDay,ctx}`. Custom handlers must authorize and resolve their own tenant-scoped records. The resource helper does this automatically, validates dates, and stores mapped timestamps in UTC.

Start/end/title mappings accept physical or model column names. Resource calendars require `viewAny`, only disclose links allowed by `view`/`update`, and reject foreign-tenant moves. Moves use direct timestamp persistence rather than resource form lifecycle hooks. Keyboard users can use the Move dialog; rejected requests roll back optimistically displayed events.

See [the calendar guide](https://pupitre.dev/plugins/calendar/) for complete configuration and timezone behavior.
