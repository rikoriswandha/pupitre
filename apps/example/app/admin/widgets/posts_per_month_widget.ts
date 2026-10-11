import { defineWidget } from '@rikology/pupitre'
import Post from '#models/post'

export default defineWidget('posts-per-month')
  .heading('Posts per month')
  .chart('bar', async ({ ctx, filters }) => {
    const query = Post.query().select('created_at')
    if (ctx.pupitre.tenant) query.where('tenant_id', ctx.pupitre.tenant.id)
    if (typeof filters.status === 'string' && filters.status) query.where('status', filters.status)
    const posts = await query.orderBy('created_at', 'asc')
    const now = new Date()
    const months = Array.from(
      { length: 6 },
      (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    )
    return {
      labels: months.map((month) => month.toLocaleDateString('en', { month: 'short' })),
      datasets: [
        {
          label: 'Posts',
          data: months.map(
            (month) =>
              posts.filter((post) => {
                const created = post.createdAt.toJSDate()
                return (
                  created.getFullYear() === month.getFullYear() &&
                  created.getMonth() === month.getMonth()
                )
              }).length
          ),
        },
      ],
    }
  })
