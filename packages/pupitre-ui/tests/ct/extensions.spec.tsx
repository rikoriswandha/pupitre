import { test, expect } from '@playwright/experimental-ct-react'
import { AxeBuilder } from '@axe-core/playwright'
import { ExtensionStory } from './stories/extension.story.js'

for (const layout of ['table', 'grid'] as const) {
  test(`extension fields, entries and ${layout} columns render through the registry`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<ExtensionStory layout={layout} />)
    await expect(view.getByRole('radio', { name: '2 stars' })).toBeChecked()
    await view.getByRole('radio', { name: '4 stars' }).check()
    await expect(view.getByRole('radio', { name: '4 stars' })).toBeChecked()
    await expect(view.getByRole('status', { name: 'Selected rating' })).toHaveText('4')
    await expect(view.getByText('Excellent of 5 stars — Record A')).toBeVisible()
    await expect(view.getByText('Excellent of 5 stars for 7 — Score')).toBeVisible()
    const results = await new AxeBuilder({ page: page as never })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
    await view.unmount()
  })
}
