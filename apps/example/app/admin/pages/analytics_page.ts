import { definePage } from '@rikology/pupitre'
import postsByStatus from '../widgets/posts_by_status_widget.js'
import postsPerMonth from '../widgets/posts_per_month_widget.js'

export default definePage('analytics')
  .path('/analytics')
  .title('Analytics')
  .widgets([postsByStatus, postsPerMonth])
  .filters([
    {
      name: 'status',
      label: 'Post status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
      ],
    },
  ])
