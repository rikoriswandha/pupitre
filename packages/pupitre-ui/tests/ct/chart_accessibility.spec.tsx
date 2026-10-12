import { expect, test } from '@playwright/experimental-ct-react'
import { ChartAccessibilityStory } from './stories/chart_accessibility.story.js'

test('charts expose their series legend with distinct default colors', async ({ mount }) => {
  const view = await mount(<ChartAccessibilityStory />)
  await expect(view.getByText('Revenue', { exact: true })).toBeVisible()
  await expect(view.getByText('Orders', { exact: true })).toBeVisible()
  const colors = await view
    .locator('path.recharts-line-curve')
    .evaluateAll((paths) => paths.map((path) => path.getAttribute('stroke')))
  expect(colors).toHaveLength(2)
  expect(colors[0]).toBeTruthy()
  expect(colors[1]).toBeTruthy()
  expect(colors[0]).not.toBe(colors[1])
})
