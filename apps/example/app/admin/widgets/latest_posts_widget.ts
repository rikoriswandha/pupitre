import { defineWidget, table } from '@rikology/pupitre'
import Post, { POST_STATUS_COLORS, POST_STATUS_OPTIONS } from '#models/post'

export default defineWidget('latest-posts', Post)
  .heading('Latest posts')
  .span(2)
  .table((t) =>
    t
      .query((query, ctx) => {
        const params = ctx.request.qs() as Record<string, unknown>
        const filters = params.filters
        if (
          filters &&
          typeof filters === 'object' &&
          'status' in filters &&
          typeof filters.status === 'string' &&
          filters.status
        )
          query.where('status', filters.status)
        query.orderBy('created_at', 'desc')
      })
      .columns([
        table.text('title').label('Title').sortable(),
        table
          .badge('status')
          .label('Status')
          .options(POST_STATUS_OPTIONS)
          .colors(POST_STATUS_COLORS)
          .sortable(),
      ])
      .paginated([5, 10, 25])
  )
