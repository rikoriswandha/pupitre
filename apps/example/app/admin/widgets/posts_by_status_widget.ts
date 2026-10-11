import { defineWidget, stat } from '@rikology/pupitre'
import Post from '#models/post'

export default defineWidget('posts-by-status')
  .heading('Posts by status')
  .stats(async ({ ctx, filters }) => {
    const query = Post.query()
    if (ctx.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
    if (typeof filters.status === 'string' && filters.status) query.where('status', filters.status)
    const rows = await query.select('status').count('* as total').groupBy('status')
    const countFor = (status: string) =>
      Number(rows.find((row) => row.status === status)?.$extras.total ?? 0)
    const recent = await Post.query()
      .if(Boolean(ctx.pupitre.tenant), (scoped) =>
        scoped.where('tenant_id', ctx.pupitre.tenant!.id)
      )
      .orderBy('created_at', 'asc')
      .select('created_at')
    const now = new Date()
    const chart = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
      return recent.filter((post) => {
        const created = post.createdAt.toJSDate()
        return (
          created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth()
        )
      }).length
    })
    return [
      stat('Published', countFor('published')).color('success').chart(chart),
      stat('Draft', countFor('draft')).color('warning'),
    ]
  })
