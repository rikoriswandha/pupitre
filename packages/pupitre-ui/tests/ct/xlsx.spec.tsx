import { test, expect } from '@playwright/experimental-ct-react'
import { XlsxPickerStory } from './stories/xlsx.story.js'

test('export format picker labels options and submits the selected format', async ({
  mount,
  page,
}) => {
  await mount(<XlsxPickerStory />)
  await expect(page.getByRole('group', { name: 'Export format' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'CSV', exact: true })).toBeChecked()
  const radio = page.getByRole('radio', { name: 'CSV', exact: true })
  await expect(radio).toHaveClass(/accent-primary/)
  const bounds = await radio.boundingBox()
  expect(bounds!.width).toBeGreaterThanOrEqual(24)
  expect(bounds!.height).toBeGreaterThanOrEqual(24)
  await page.getByRole('radio', { name: 'Excel (XLSX)' }).check()
  await expect(page.getByRole('radio', { name: 'CSV', exact: true })).not.toBeChecked()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByTestId('submitted')).toHaveText('xlsx')
})
