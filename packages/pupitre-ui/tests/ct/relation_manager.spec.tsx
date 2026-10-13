import { test, expect } from '@playwright/experimental-ct-react'
import { FixtureStory } from './stories/catalog.story.js'

test('RelationManager renders its relation table with an accessible label', async ({ mount }) => {
  const view = await mount(<FixtureStory name="RelationManager" />)
  await expect(view.getByRole('region', { name: 'Comments' })).toBeVisible()
  // The tab shows the visible label and badge; the section keeps a screen-reader heading.
  await expect(view.getByRole('heading', { name: 'Comments' })).toHaveCount(1)
  await expect(view.locator('[data-relation="comments"]')).toBeVisible()
  await expect(view.getByRole('button', { name: 'Attach' })).toHaveCount(0)
  await view.unmount()
})
