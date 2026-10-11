import { test, expect } from '@playwright/experimental-ct-react'
import { GlobalSearchStory } from './stories/global_search.story.js'

test('opens with the configured shortcut, groups results, and visits a selection', async ({
  mount,
  page,
}) => {
  const story = await mount(<GlobalSearchStory />)
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Global search' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Search resources' }).fill('field')
  await expect(page.getByText('Posts', { exact: true })).toBeVisible()
  await expect(page.getByTestId('search-request')).toHaveText(
    '{"url":"/admin/_pupitre/search?q=field","accept":"application/json"}'
  )
  await expect(page.getByRole('option', { name: /Field Notes/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('search-navigation')).toHaveText('/admin/posts/7')
  await story.unmount()
})
