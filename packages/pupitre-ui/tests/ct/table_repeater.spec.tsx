import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { TableRepeaterStory } from './stories/table_repeater.story.js'

for (const theme of ['light', 'dark'] as const) {
  test(`table repeater keyboard actions, cell errors and accessibility (${theme})`, async ({
    mount,
    page,
  }) => {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
      theme
    )
    const view = await mount(<TableRepeaterStory errors />)
    const rows = view.locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).getByText('Invalid SKU')).toHaveCount(0)
    await expect(rows.nth(1).locator('td').first().getByText('Invalid SKU')).toBeVisible()
    await expect(rows.nth(1).getByLabel('SKU')).toHaveAttribute('aria-invalid', 'true')
    await view.getByRole('button', { name: 'Move Item 2 up', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(rows.nth(0).getByLabel('SKU')).toHaveValue('B')
    await expect(rows.nth(0).getByText('Invalid SKU')).toBeVisible()
    await view
      .getByRole('button', { name: 'Drag Item 1 to reorder', exact: true })
      .press('ArrowDown')
    await expect(rows.nth(1).getByLabel('SKU')).toHaveValue('B')
    await view.getByRole('button', { name: 'Clone Item 1', exact: true }).press('Enter')
    await expect(rows).toHaveCount(3)
    await expect(view.getByRole('button', { name: 'Add item', exact: true })).toBeDisabled()
    await expect(rows.nth(1).getByLabel('SKU')).toHaveValue('A')
    const cloned = await page.evaluate(() => {
      const runtimeWindow = window as Window & {
        tableRepeaterStore?: { get(path: string): unknown }
      }
      return runtimeWindow.tableRepeaterStore?.get('/data/items/1')
    })
    expect(cloned).toMatchObject({ sku: 'A' })
    expect(cloned).not.toHaveProperty('_relationKey')
    await view.getByRole('button', { name: 'Remove Item 2', exact: true }).press('Enter')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1).getByLabel('SKU')).toHaveValue('B')
    await view.getByRole('button', { name: 'Add item', exact: true }).press('Enter')
    await expect(rows).toHaveCount(3)
    await rows.nth(2).getByLabel('SKU').fill('C')
    await page.evaluate(async () => {
      await Promise.all(
        document.getAnimations().map((animation) => animation.finished.catch(() => {}))
      )
    })
    const result = await new AxeBuilder({ page: page as never })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-base-ui-focus-guard]')
      .analyze()
    expect(result.violations).toEqual([])
    await page.setViewportSize({ width: 390, height: 844 })
    const geometry = await view.getByRole('region', { name: 'Line items' }).evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      scrollWidth: element.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.width).toBeLessThanOrEqual(390)
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.width)
    expect(geometry.documentWidth).toBeLessThanOrEqual(390)
  })
}

for (const mode of ['disabled', 'readOnly'] as const) {
  test(`table repeater ${mode} blocks fields and row operations`, async ({ mount }) => {
    const view = await mount(<TableRepeaterStory {...{ [mode]: true }} />)
    await expect(view.getByLabel('SKU').first()).toBeDisabled()
    await expect(view.getByRole('button', { name: 'Add item' })).toBeDisabled()
    await expect(view.getByRole('button', { name: 'Remove Item 1', exact: true })).toBeDisabled()
  })
}

test('table repeater drag handle moves a row without losing bound values', async ({ mount }) => {
  const view = await mount(<TableRepeaterStory />)
  await view
    .getByRole('button', { name: 'Drag Item 1 to reorder' })
    .dragTo(view.locator('tbody tr').nth(1))
  await expect(view.locator('tbody tr').first().getByLabel('SKU')).toHaveValue('B')
})

test('table repeater keeps radio and checkbox option labels visible', async ({ mount }) => {
  const view = await mount(<TableRepeaterStory choices />)
  for (const label of ['Normal', 'Urgent', 'Email', 'SMS']) {
    const optionLabel = view.locator('tbody tr').first().locator('label').filter({ hasText: label })
    await expect(optionLabel).toBeVisible()
    expect(
      await optionLabel.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(10)
  }
})

test('table repeater hides slider field labels but preserves accessible names', async ({
  mount,
}) => {
  const view = await mount(<TableRepeaterStory choices />)
  const row = view.locator('tbody tr').first()
  await expect(view.getByRole('columnheader', { name: 'Rating', exact: true })).toBeVisible()
  await expect(row.getByRole('slider', { name: 'Rating', exact: true })).toBeVisible()
  const label = row.locator('label').filter({ hasText: /^Rating$/ })
  expect(
    await label.evaluate((element) => element.getBoundingClientRect().width)
  ).toBeLessThanOrEqual(1)
})
