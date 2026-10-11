import { test, expect } from '@playwright/experimental-ct-react'
import { TableDataStory } from './stories/table_data.story.js'

test('group sections collapse rows, show summaries, and submit per-column search', async ({
  mount,
}) => {
  const view = await mount(<TableDataStory />)
  await expect(view.getByText('Views sum: 30')).toBeVisible()
  await expect(view.getByText('Views sum: 10')).toBeVisible()
  await expect(view.getByRole('region', { name: 'Table summary', exact: true })).toContainText(
    'Views sum:'
  )
  await expect(view.getByText('Draft memo')).toBeVisible()
  await expect(view.getByText('Published report')).toBeVisible()

  const draftGroup = view.getByRole('button', { name: /Status: draft/ })
  await expect(draftGroup).toHaveAttribute('aria-expanded', 'true')
  await draftGroup.click()
  await expect(draftGroup).toHaveAttribute('aria-expanded', 'false')
  await expect(view.getByText('Draft memo')).toHaveCount(0)
  await expect(view.getByText('Published report')).toBeVisible()

  const search = view.getByRole('searchbox', { name: 'Search Title' })
  await search.fill('Published')
  await search.press('Enter')
  await expect
    .poll(() =>
      view.evaluate(
        () => (window as Window & { __tableDataVisits?: string[] }).__tableDataVisits?.at(-1) ?? ''
      )
    )
    .toContain('columns%5Btitle%5D%5Bsearch%5D=Published')
})
