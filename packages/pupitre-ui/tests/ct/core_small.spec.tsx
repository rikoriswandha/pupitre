import { expect, test } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { CoreSmallStory, CoreSmallShellStory } from './stories/core_small.story.js'

for (const dark of [false, true]) {
  test(`indicator and radar/scatter are accessible (${dark ? 'dark' : 'light'})`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<CoreSmallStory dark={dark} />)
    const indicator = view.locator('[data-environment-indicator]')
    await expect(indicator.locator('[aria-hidden="true"]')).toHaveText('Staging')
    await expect(indicator.locator('.sr-only')).toHaveText('Environment: Staging')
    await expect(indicator).toHaveClass(/bg-warning-soft/)
    await expect(indicator).not.toHaveAttribute('style')
    await expect(view.locator('.recharts-radar-polygon')).toBeVisible()
    await expect(view.locator('.recharts-scatter-symbol')).toHaveCount(2)
    await expect(view.getByRole('table')).toHaveCount(2)
    await expect(view.getByRole('table').nth(1)).toContainText('Products')
    const results = await new AxeBuilder({ page: page as never })
      .include('[data-environment-indicator]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

for (const sidebar of ['expanded', 'collapsed', 'top-nav'] as const) {
  test(`environment badge fits ${sidebar} desktop and mobile layouts in both themes`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<CoreSmallShellStory sidebar={sidebar} dark={false} />)
    for (const dark of [false, true]) {
      await view.update(<CoreSmallShellStory sidebar={sidebar} dark={dark} />)
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 })
        const badge = view.locator('[data-environment-indicator]')
        await expect(badge).toBeVisible()
        const box = await badge.boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width)
        await page.evaluate(() =>
          Promise.all(document.getAnimations().map((animation) => animation.finished))
        )
        const results = await new AxeBuilder({ page: page as never })
          .include('[data-environment-indicator]')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
        expect(results.violations).toEqual([])
      }
    }
  })
}
