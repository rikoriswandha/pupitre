import { test, expect } from '@playwright/experimental-ct-react'
import { FixtureStory } from './stories/catalog.story.js'

test('RelationManager renders its relation tab content, label, badge and table', async ({
  mount,
}) => {
  const view = await mount(<FixtureStory name="RelationManager" />)
  await expect(view.getByRole('region', { name: 'Comments' })).toBeVisible()
  await expect(view.getByRole('heading', { name: 'Comments' })).toBeVisible()
  await expect(view.getByText('7')).toBeVisible()
  await expect(view.locator('[data-relation="comments"]')).toBeVisible()
  await expect(view.getByRole('button', { name: 'Attach' })).toHaveCount(0)
  await view.unmount()
})
