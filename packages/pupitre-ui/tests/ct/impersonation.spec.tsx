import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/experimental-ct-react'
import { ImpersonationStory } from './stories/impersonation.story.js'

for (const dark of [false, true]) {
  test(`impersonation banner is accessible in ${dark ? 'dark' : 'light'} theme`, async ({
    mount,
    page,
  }) => {
    await mount(<ImpersonationStory dark={dark} />)
    await expect(page.getByRole('region', { name: 'Impersonation' })).toContainText(
      'You are signed in as Editor'
    )
    await expect(page.getByRole('button', { name: 'Leave', exact: true })).toBeVisible()
    const result = await new AxeBuilder({ page: page as never })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(result.violations).toEqual([])
  })
}
