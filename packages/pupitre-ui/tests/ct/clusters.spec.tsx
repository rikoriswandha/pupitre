import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/experimental-ct-react'
import { ClustersStory } from './stories/clusters.story.js'

for (const width of [1200, 390]) {
  test(`cluster navigation works with keyboard and axe at ${width}px`, async ({ mount, page }) => {
    await page.setViewportSize({ width, height: 800 })
    await mount(<ClustersStory />)
    const nav = page.getByRole('navigation', { name: 'Cluster navigation' })
    await expect(nav.getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await nav.getByRole('link', { name: 'Categories' }).focus()
    await page.keyboard.press('Tab')
    await expect(nav.getByRole('link', { name: 'Tags' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#tags$/)
    const box = await nav.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(width)
    const results = await new AxeBuilder({ page: page as never })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}
