import { definePage } from '@rikology/pupitre'
import { calendar, calendarWidget, resourceEvents } from '@rikology/pupitre-calendar'
import PostResource from './resources/post_resource.js'

const posts = calendarWidget('publication-calendar')
  .heading('Publication calendar')
  .events(resourceEvents(PostResource, { start: 'published_at', title: 'title', color: '#2563eb' }))
  .lazy(false)

export const calendarDemo = calendar({
  pages: [
    definePage('calendar')
      .title('Publication calendar')
      .navigation({ group: 'Showcase' })
      .widgets([posts]),
  ],
})
