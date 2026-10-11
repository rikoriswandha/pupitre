import { test, expect } from '@playwright/experimental-ct-react'
import { TenantSwitcherStory } from './stories/tenant_switcher.story.js'

test('posts selected tenant id through the implicit switcher', async ({ mount, page }) => {
  const story = await mount(<TenantSwitcherStory />)
  await page.getByRole('button', { name: 'Switch tenant' }).click()
  await page.getByRole('menuitem', { name: 'Globex' }).click()
  await expect(page.getByTestId('tenant-switch')).toHaveText(
    '{"url":"/admin/_pupitre/tenant","method":"post","data":{"tenant":2}}'
  )
  await story.unmount()
})
