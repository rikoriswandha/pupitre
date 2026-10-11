import { expect, test } from '@playwright/experimental-ct-react'
import { ChartAccessibilityStory } from './stories/chart_accessibility.story.js'

test('charts expose their series legend with distinct default colors', async ({ mount }) => {
  const view = await mount(<ChartAccessibilityStory />)
  await expect(view.getByText('Revenue', { exact: true })).toBeVisible()
  await expect(view.getByText('Orders', { exact: true })).toBeVisible()
  await expect(view.locator('path.recharts-line-curve[stroke="#2563eb"]')).toHaveCount(1)
  await expect(view.locator('path.recharts-line-curve[stroke="#db2777"]')).toHaveCount(1)
})
