import { defineWidget, stat } from '@rikology/pupitre'
import { POST_STATUS_COLORS, POST_STATUS_OPTIONS } from '#models/post'
import type Post from '#models/post'

export default defineWidget('post-edit-summary')
  .heading('Post summary')
  .stats(({ record }) => {
    const post = record as Post | undefined
    return post
      ? [
          // Stat values are free-form, so map the stored enum to its label here.
          stat('Status', POST_STATUS_OPTIONS[post.status] ?? post.status).color(
            POST_STATUS_COLORS[post.status] ?? 'gray'
          ),
          stat('Views', post.viewsCount),
        ]
      : []
  })
