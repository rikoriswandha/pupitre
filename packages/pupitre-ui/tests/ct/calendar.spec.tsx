import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { CalendarStory } from './stories/calendar.story.js'

test('calendar views, period navigation and keyboard move persist', async ({ mount, page }) => {
  await mount(<CalendarStory />)
  const select = page.getByRole('combobox', { name: 'Calendar view' })
  for (const view of ['month', 'week', 'day', 'list']) {
    await select.selectOption(view)
    await expect(page.getByText('Launch', { exact: true })).toBeVisible()
  }
  const heading = page.locator('strong[aria-live="polite"]')
  const original = await heading.textContent()
  const initialRange = await page.getByTestId('calendar-range-request').textContent()
  await page.getByRole('button', { name: 'Next period' }).click()
  await expect(heading).not.toHaveText(original!)
  await expect(page.getByTestId('calendar-range-request')).not.toHaveText(initialRange!)
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(heading).toHaveText(original!)
  await expect(page.getByTestId('calendar-range-request')).toHaveText(initialRange!)
  await select.selectOption('day')
  const button = page.getByRole('button', { name: 'Move Launch', exact: true })
  await button.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('checkbox', { name: 'All day', exact: true })).toHaveClass(/size-6/)
  const today = new Date().toISOString().slice(0, 10)
  await dialog.getByLabel('Start', { exact: true }).fill(`${today}T11:30`)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('11:30', { exact: true })).toBeVisible()
  await expect(page.getByTestId('calendar-request')).toContainText('11:30')
})
for (const status of [403, 422] as const)
  test(`calendar rollback preserves the original event and dialog on ${status}`, async ({
    mount,
    page,
  }) => {
    await mount(<CalendarStory failure={status} />)
    await page.getByRole('button', { name: 'Move Launch', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Start', { exact: true })
      .fill(`${new Date().toISOString().slice(0, 10)}T12:00`)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('not saved')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByText('09:00', { exact: true })).toBeVisible()
  })
for (const dark of [false, true])
  test(`calendar accessibility ${dark ? 'dark' : 'light'}`, async ({ mount, page }) => {
    await mount(<CalendarStory dark={dark} />)
    await page.getByRole('button', { name: 'Move Launch', exact: true }).click()
    await page.evaluate(async () => {
      await Promise.all(
        document.getAnimations().map((animation) => animation.finished.catch(() => {}))
      )
    })
    const results = await new AxeBuilder({ page: page as never })
      .exclude('[data-base-ui-focus-guard]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
test('calendar defaults to agenda on a narrow viewport', async ({ mount, page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(<CalendarStory />)
  await expect(page.getByRole('combobox', { name: 'Calendar view' })).toHaveValue('list')
  await page.getByRole('combobox', { name: 'Calendar view' }).selectOption('month')
  await expect(page.getByRole('button', { name: 'Move Launch' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const scrolling = await page
    .locator('[aria-label="Month"]')
    .locator('..')
    .evaluate((element) => ({
      overflow: getComputedStyle(element).overflowX,
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
  expect(scrolling.overflow).toBe('auto')
  expect(scrolling.scrollWidth).toBeGreaterThan(scrolling.width)
  const drag = page.locator('[data-calendar-drag]')
  await expect(drag).toHaveAttribute('tabindex', '-1')
  await expect(drag).toHaveAttribute('aria-hidden', 'true')
  await expect(drag).not.toHaveAttribute('aria-describedby')
  const control = page.getByRole('combobox', { name: 'Calendar view' })
  expect(
    await control.evaluate((element) => element.getBoundingClientRect().height)
  ).toBeGreaterThanOrEqual(32)
  expect(
    await control.evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopWidth))
  ).toBeGreaterThan(0)
})

test('timed intervals cover every day and hour with an exclusive end', async ({ mount, page }) => {
  await mount(<CalendarStory intervals />)
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const third = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  await expect(
    page.locator(`[data-calendar-date="${tomorrow}T00:00"]`).getByText('Overnight', { exact: true })
  ).toBeVisible()
  for (const date of [today, tomorrow, third])
    await expect(
      page.locator(`[data-calendar-date="${date}T00:00"]`).getByText('Three days', { exact: true })
    ).toBeVisible()
  await page.getByRole('combobox', { name: 'Calendar view' }).selectOption('day')
  for (const hour of ['09', '10', '11'])
    await expect(
      page
        .locator(`[data-calendar-date="${today}T${hour}:00"]`)
        .getByText('Long meeting', { exact: true })
    ).toBeVisible()
  await expect(
    page.locator(`[data-calendar-date="${today}T12:00"]`).getByText('Long meeting', { exact: true })
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Next period' }).click()
  for (const hour of ['00', '01'])
    await expect(
      page
        .locator(`[data-calendar-date="${tomorrow}T${hour}:00"]`)
        .getByText('Overnight', { exact: true })
    ).toBeVisible()
  await expect(
    page.locator(`[data-calendar-date="${tomorrow}T02:00"]`).getByText('Overnight', { exact: true })
  ).toHaveCount(0)
})

test('calendar has only one draggable start segment for a multi-day event', async ({
  mount,
  page,
}) => {
  await mount(<CalendarStory intervals />)
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const first = page.locator(`[data-calendar-date="${today}T00:00"]`)
  const next = page.locator(`[data-calendar-date="${tomorrow}T00:00"]`)
  await expect(page.locator('[data-calendar-drag]')).toHaveCount(1)
  const handle = first.locator('[data-calendar-drag]')
  const from = await handle.boundingBox()
  const target = await next.boundingBox()
  const origin = await first.boundingBox()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + from!.height / 2, { steps: 3 })
  await page.mouse.move(
    from!.x + from!.width / 2 + target!.x - origin!.x,
    from!.y + from!.height / 2 + target!.y - origin!.y,
    { steps: 10 }
  )
  await page.mouse.up()
  await expect(page.getByTestId('calendar-request')).toContainText(`${tomorrow}T15:00:00`)
})

test('calendar clears committed optimistic state after reload failure', async ({ mount, page }) => {
  await mount(<CalendarStory reloadFailure />)
  await page.getByRole('button', { name: 'Move Launch', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Start', { exact: true })
    .fill(`${new Date().toISOString().slice(0, 10)}T12:00`)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Unable to load calendar events')
  await page.getByRole('button', { name: 'Next period' }).click()
  await expect(page.getByText('Fresh period', { exact: true })).toBeVisible()
  await expect(page.getByText('Launch', { exact: true })).toHaveCount(0)
})
