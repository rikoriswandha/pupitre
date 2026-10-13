import { expect, test } from '@playwright/experimental-ct-react'
import { SparseRecordStory } from './stories/infolist.story.js'

test('record sheets fold three or more empty fields behind a toggle', async ({ mount }) => {
  const view = await mount(<SparseRecordStory empties={4} />)
  await expect(view.getByText('Completed', { exact: true })).toBeVisible()
  await expect(view.getByText('Optional 1', { exact: true })).toBeHidden()
  const toggle = view.getByRole('button', { name: 'Show 4 empty fields' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(view.getByText('Optional 4', { exact: true })).toBeVisible()
  await expect(view.getByRole('button', { name: 'Hide empty fields' })).toHaveAttribute(
    'aria-expanded',
    'true'
  )
})

test('a couple of empty fields stay inline without a toggle', async ({ mount }) => {
  const view = await mount(<SparseRecordStory empties={2} />)
  await expect(view.getByText('Optional 2', { exact: true })).toBeVisible()
  await expect(view.getByRole('button', { name: /empty fields/ })).toHaveCount(0)
})
