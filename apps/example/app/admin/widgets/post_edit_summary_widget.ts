import { defineWidget, stat } from '@rikology/pupitre'
import type Post from '#models/post'

export default defineWidget('post-edit-summary')
  .heading('Post summary')
  .stats(({ record }) => {
    const post = record as Post | undefined
    return post
      ? [
          stat('Status', post.status).color(post.status === 'published' ? 'success' : 'warning'),
          stat('Views', post.viewsCount),
        ]
      : []
  })
