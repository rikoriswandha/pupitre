import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { QueryLimitStory, TableQueryStory, TableMessageStory } from './stories/table_query.story.js'
import { ExtensionStory } from './stories/extension.story.js'

test('query URL cap rejects encoded long values but permits 64 short rules', async ({
  mount,
  page,
}) => {
  const view = await mount(<QueryLimitStory long prefix="comments" />)
  await expect(page.getByRole('button', { name: 'Apply query', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Applied query')).toHaveText('')
  await view.unmount()
  await mount(<QueryLimitStory prefix="comments" />)
  const apply = page.getByRole('button', { name: 'Apply query', exact: true })
  await expect(apply).toBeEnabled()
  await apply.click()
  const query = JSON.parse(await page.getByLabel('Applied query').innerText()) as {
    groups: unknown[][]
  }
  expect(query.groups.flat()).toHaveLength(64)
})

test('query cap includes unrelated URL state and replaces its own old filter/page keys', async ({
  mount,
  page,
}) => {
  await page.evaluate(() => {
    const query = new URLSearchParams({ 'q': 'x'.repeat(3000), 'other[sort]': '-title' })
    window.history.replaceState({}, '', `${window.location.pathname}?${query}`)
  })
  const view = await mount(<QueryLimitStory prefix="comments" />)
  await expect(page.getByRole('button', { name: 'Apply query', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Applied query')).toHaveText('')
  await view.unmount()
  await page.evaluate(() => {
    const query = new URLSearchParams({
      'comments[filters][query]': 'x'.repeat(7000),
      'comments[filters][query][old]': 'y'.repeat(1000),
      'comments[page]': 'z'.repeat(1000),
    })
    window.history.replaceState({}, '', `${window.location.pathname}?${query}`)
  })
  await mount(<QueryLimitStory prefix="comments" />)
  const apply = page.getByRole('button', { name: 'Apply query', exact: true })
  await expect(apply).toBeEnabled()
  await apply.click()
  const query = JSON.parse(await page.getByLabel('Applied query').innerText()) as {
    groups: unknown[][]
  }
  expect(query.groups.flat()).toHaveLength(64)
})

test('deferred table Apply blocks incomplete edits and over-limit queries without committing stale rules', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory deferred />)
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  const apply = page.getByRole('button', { name: 'Apply', exact: true })
  await expect(apply).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText(
    'Complete all query rules before applying filters.'
  )
  const value = page.getByLabel('Group 1, rule 1: value', { exact: true })
  await value.fill('hello')
  await expect(apply).toBeEnabled()
  await apply.click()
  const previous = await page.getByLabel('Visited URL').innerText()
  await page.getByRole('combobox', { name: 'Group 1, rule 1: operator' }).click()
  await page.getByRole('option', { name: 'Contains', exact: true }).click()
  await value.fill('')
  await expect(apply).toBeDisabled()
  await expect(page.getByLabel('Visited URL')).toHaveText(previous)
  await value.fill('hello again')
  await expect(apply).toBeEnabled()
  await page.getByRole('button', { name: 'Add rule', exact: true }).click()
  await expect(apply).toBeDisabled()
  await page.getByRole('button', { name: 'Remove Group 1, rule 2', exact: true }).click()
  await expect(apply).toBeEnabled()
  await page.evaluate(() => {
    const query = new URLSearchParams(window.location.search)
    query.set('q', 'x'.repeat(8192))
    window.history.replaceState({}, '', `${window.location.pathname}?${query}`)
  })
  await value.fill('over limit')
  await expect(apply).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('Query exceeds the URL size limit.')
  await expect(page.getByLabel('Visited URL')).toHaveText(previous)
})

test('incomplete deferred rules survive closing the lazy query editor and keep Apply blocked', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory deferred layout="dropdown" />)
  const filters = page.getByRole('button', { name: 'Filters', exact: true })
  await filters.focus()
  await filters.press('Enter')
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  const value = page.getByLabel('Group 1, rule 1: value', { exact: true })
  await value.fill('staged')
  await page.getByRole('button', { name: 'Add rule', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(filters).toBeFocused()
  await filters.press('Enter')
  await expect(value).toHaveValue('staged')
  await expect(page.getByLabel('Group 1, rule 2: value', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText(
    'Complete all query rules before applying filters.'
  )
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click()
  await expect(page.getByLabel('Group 1, rule 1: value', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled()
  await expect(page.getByLabel('Visited URL')).toHaveText('')
})

for (const layout of ['above', 'dropdown', 'slideover'] as const) {
  test(`query editor applies OR groups, typed ranges and reset in ${layout}`, async ({
    mount,
    page,
  }) => {
    await mount(<TableQueryStory layout={layout} />)
    if (layout !== 'above') await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
    await page.getByRole('textbox', { name: 'Group 1, rule 1: value', exact: true }).fill('hello')
    await expect(page.getByLabel('Visited URL')).toHaveText('')
    await page.getByRole('button', { name: 'Add OR group', exact: true }).click()
    await page.getByRole('combobox', { name: 'Group 2, rule 1: constraint', exact: true }).click()
    await page.getByRole('option', { name: 'Price', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'Group 2, rule 1: value 1', exact: true }).fill('10')
    await page.getByRole('spinbutton', { name: 'Group 2, rule 1: value 2', exact: true }).fill('20')
    await page.getByRole('button', { name: 'Apply query', exact: true }).click()
    const applied = new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost')
    expect(JSON.parse(applied.searchParams.get('filters[query]')!)).toEqual({
      groups: [
        [{ constraint: 'title', operator: 'contains', value: 'hello' }],
        [{ constraint: 'price', operator: 'between', value: [10, 20] }],
      ],
    })
    await page.getByRole('button', { name: 'Remove Group 2, rule 1', exact: true }).click()
    await page.getByRole('button', { name: 'Reset query', exact: true }).click()
    const reset = new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost')
    expect(reset.searchParams.has('filters[query]')).toBe(false)
  })
}

test('query editor blocks reversed numeric/date ranges and invalid relationship counts', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory />)
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  const constraint = page.getByRole('combobox', { name: 'Group 1, rule 1: constraint' })
  const apply = page.getByRole('button', { name: 'Apply query', exact: true })
  await constraint.click()
  await page.getByRole('option', { name: 'Price', exact: true }).click()
  await page.getByLabel('Group 1, rule 1: value 1', { exact: true }).fill('20')
  await page.getByLabel('Group 1, rule 1: value 2', { exact: true }).fill('10')
  await expect(apply).toBeDisabled()
  await page.getByLabel('Group 1, rule 1: value 2', { exact: true }).fill('20')
  await expect(apply).toBeEnabled()
  await constraint.click()
  await page.getByRole('option', { name: 'Published', exact: true }).click()
  await page.getByRole('combobox', { name: 'Group 1, rule 1: operator' }).click()
  await page.getByRole('option', { name: 'Between', exact: true }).click()
  await page.getByLabel('Group 1, rule 1: value 1', { exact: true }).fill('2026-10-12')
  await page.getByLabel('Group 1, rule 1: value 2', { exact: true }).fill('2026-10-01')
  await expect(apply).toBeDisabled()
  await page.getByLabel('Group 1, rule 1: value 2', { exact: true }).fill('2026-10-12')
  await expect(apply).toBeEnabled()
  await constraint.click()
  await page.getByRole('option', { name: 'Comments', exact: true }).click()
  await page.getByRole('combobox', { name: 'Group 1, rule 1: operator' }).click()
  await page.getByRole('option', { name: 'Minimum count', exact: true }).click()
  const count = page.getByRole('spinbutton', { name: 'Group 1, rule 1: value', exact: true })
  await expect(count).toHaveAttribute('min', '0')
  await expect(count).toHaveAttribute('step', '1')
  await count.fill('-1')
  await expect(apply).toBeDisabled()
  await count.fill('1.5')
  await expect(apply).toBeDisabled()
  await count.fill('0')
  await expect(apply).toBeEnabled()
  await expect(page.getByLabel('Visited URL')).toHaveText('')
})

test('typed date, boolean and relationship rules combine with AND and negation', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory deferred />)
  async function choose(label: string, value: string) {
    const trigger = page.getByRole('combobox', { name: label, exact: true })
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(trigger).toHaveAttribute('aria-controls', /.+/)
    const list = await trigger.getAttribute('aria-controls')
    const option = page.locator(`[id="${list}"]`).getByRole('option', { name: value, exact: true })
    await option.focus()
    await expect(option).toBeFocused()
    await option.press('Enter')
    await expect(trigger).toHaveText(value)
  }
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  await page.getByRole('combobox', { name: 'Group 1, rule 1: constraint' }).click()
  await page.getByRole('option', { name: 'Published', exact: true }).click()
  await page.getByLabel('Group 1, rule 1: value', { exact: true }).fill('2026-10-12')
  await page.getByRole('button', { name: 'Add rule', exact: true }).click()
  await choose('Group 1, rule 2: constraint', 'Featured')
  await page.getByRole('checkbox', { name: 'Negate rule', exact: true }).nth(1).check()
  await page.getByRole('button', { name: 'Add rule', exact: true }).click()
  await choose('Group 1, rule 3: constraint', 'Comments')
  await choose('Group 1, rule 3: operator', 'Minimum count')
  await page.getByRole('spinbutton', { name: 'Group 1, rule 3: value' }).fill('3')
  await expect(page.getByLabel('Visited URL')).toHaveText('')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  const applied = new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost')
  expect(JSON.parse(applied.searchParams.get('filters[query]')!)).toEqual({
    groups: [
      [
        { constraint: 'published', operator: 'on', value: '2026-10-12' },
        { constraint: 'featured', operator: 'true', negated: true },
        { constraint: 'comments', operator: 'minCount', value: 3 },
      ],
    ],
  })
  await expect(
    page.getByRole('region', { name: 'Advanced query' }).getByRole('status')
  ).toContainText('3 active query rules')
})

test('multi-sort has keyboard addition, priorities, primary-only aria-sort, limit and explicit clear', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory />)
  await expect(page.locator('th[aria-sort]:not([aria-sort="none"])')).toHaveCount(1)
  await page.getByRole('button', { name: 'Add Price to sort', exact: true }).focus()
  await page.getByRole('button', { name: 'Add Price to sort', exact: true }).press('Enter')
  expect(
    new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost').searchParams.get(
      'sort'
    )
  ).toBe('title,price')
  const priceHeader = page
    .getByRole('columnheader')
    .filter({ has: page.getByRole('button', { name: 'Add Price to sort', exact: true }) })
  await expect(priceHeader.getByRole('button', { name: 'Price', exact: true })).toBeVisible()
  await expect(priceHeader).toContainText('Sort priority 2, ascending')
  await expect(page.getByRole('button', { name: 'Add Published to sort' })).toBeDisabled()
  await expect(page.locator('th[aria-sort]:not([aria-sort="none"])')).toHaveCount(1)
  await expect(
    page
      .getByRole('columnheader')
      .filter({ has: page.getByRole('button', { name: 'Add Price to sort', exact: true }) })
  ).not.toHaveAttribute('aria-sort')
  await page
    .getByRole('columnheader')
    .filter({ has: page.getByRole('button', { name: 'Add Price to sort', exact: true }) })
    .getByRole('button')
    .first()
    .click({ modifiers: ['Shift'] })
  expect(
    new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost').searchParams.get(
      'sort'
    )
  ).toBe('title,-price')
  await expect(priceHeader).toContainText('Sort priority 2, descending')
  await page.getByRole('button', { name: 'Clear sorting', exact: true }).click()
  expect(
    new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost').searchParams.get(
      'sort'
    )
  ).toBe('')
  await expect(page.locator('th[aria-sort]:not([aria-sort="none"])')).toHaveCount(0)
  await expect(page.locator('th[aria-sort="none"]')).toHaveCount(3)
})

for (const dark of [false, true]) {
  test(`query controls are accessible on mobile ${dark ? 'dark' : 'light'}`, async ({
    mount,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(
      (enabled) => document.documentElement.classList.toggle('dark', enabled),
      dark
    )
    await mount(<TableQueryStory layout="dropdown" />)
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await page.getByRole('button', { name: 'Add rule group', exact: true }).focus()
    await page.getByRole('button', { name: 'Add rule group', exact: true }).press('Enter')
    await page.getByRole('combobox', { name: 'Group 1, rule 1: constraint' }).click()
    await page.getByRole('option', { name: 'Status', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Draft', exact: true }).check()
    await page.evaluate(async () => {
      const { promise, resolve } = Promise.withResolvers<number>()
      requestAnimationFrame(() => requestAnimationFrame(resolve))
      await promise
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => {}))
      )
    })
    const results = await new AxeBuilder({ page: page as never })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-base-ui-focus-guard]')
      .analyze()
    expect(results.violations).toEqual([])
    const bounds = await page.getByRole('dialog', { name: 'Filters', exact: true }).boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Reset query' }).press('Escape')
    await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeFocused()
  })
}

test('numeric typing retains decimal and negative fractions in applied predicates', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory />)
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  await page.getByRole('combobox', { name: 'Group 1, rule 1: constraint' }).click()
  await page.getByRole('option', { name: 'Price', exact: true }).click()
  await page.getByRole('combobox', { name: 'Group 1, rule 1: operator' }).click()
  await page.getByRole('option', { name: 'Greater than', exact: true }).click()
  const input = page.getByRole('spinbutton', { name: 'Group 1, rule 1: value', exact: true })
  for (const value of ['0.05', '100.05', '-0.5']) {
    await input.fill('')
    await input.pressSequentially(value)
    await expect(input).toHaveValue(value)
    await page.getByRole('button', { name: 'Apply query', exact: true }).click()
    const url = new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost')
    expect(JSON.parse(url.searchParams.get('filters[query]')!).groups[0][0].value).toBe(
      Number(value)
    )
  }
})

test('keyboard removal retains focus inside the query editor', async ({ mount, page }) => {
  await mount(<TableQueryStory />)
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  const remove = page.getByRole('button', { name: 'Remove Group 1, rule 1', exact: true })
  await remove.focus()
  await remove.press('Enter')
  await expect(page.getByRole('button', { name: 'Add rule', exact: true })).toBeFocused()
  const group = page.getByRole('button', { name: 'Remove group', exact: true })
  await group.focus()
  await group.press('Enter')
  await expect(page.getByRole('button', { name: 'Add rule group', exact: true })).toBeFocused()
})

test('reorderable implicit order never becomes an additive URL sort token', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory reorderable />)
  await expect(page.getByRole('button', { name: 'Clear sorting', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add Price to sort', exact: true }).click()
  const url = new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost')
  expect(url.searchParams.get('sort')).toBe('price')
})

test('default-sorted single-sort tables do not gain an empty toolbar', async ({ mount, page }) => {
  await mount(<TableQueryStory singleSort />)
  await expect(page.getByRole('button', { name: 'Clear sorting', exact: true })).toHaveCount(0)
  await expect(page.locator('main .border-b.px-4.py-3')).toHaveCount(0)
})

test('extension-first grid cards retain their record navigation link', async ({ mount, page }) => {
  await mount(<ExtensionStory layout="grid" />)
  const link = page.getByRole('link', { name: /Excellent/ })
  await expect(link).toHaveAttribute('href', '/ratings/7')
  await link.focus()
  await expect(link).toBeFocused()
})

test('deferred query edits survive closing the filter popup and commit with table Apply', async ({
  mount,
  page,
}) => {
  await mount(<TableQueryStory deferred layout="dropdown" />)
  const filters = page.getByRole('button', { name: 'Filters', exact: true })
  await filters.click()
  await page.getByRole('button', { name: 'Add rule group', exact: true }).click()
  await page.getByRole('textbox', { name: 'Group 1, rule 1: value', exact: true }).fill('staged')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Visited URL')).toHaveText('')
  await filters.click()
  await expect(
    page.getByRole('textbox', { name: 'Group 1, rule 1: value', exact: true })
  ).toHaveValue('staged')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  const url = new URL(await page.getByLabel('Visited URL').innerText(), 'http://localhost')
  expect(JSON.parse(url.searchParams.get('filters[query]')!)).toEqual({
    groups: [[{ constraint: 'title', operator: 'contains', value: 'staged' }]],
  })
})

test('complete table messages support reordered host translations and singular grouped rows', async ({
  mount,
  page,
}) => {
  await mount(<TableMessageStory />)
  const edit = page.getByRole('button', { name: 'Baris 7: ubah Title (Original)', exact: true })
  await edit.focus()
  await edit.press('Enter')
  const input = page.getByRole('textbox', { name: 'Baris 7: Title', exact: true })
  await expect(input).toBeFocused()
  await input.fill('Changed')
  await input.press('Escape')
  await expect(edit).toBeFocused()
  const group = page.getByRole('button', { name: 'Draft 1 row', exact: true })
  await group.click()
  await expect(page.getByText('Grouped record', { exact: true })).toHaveCount(0)
  await group.click()
  await expect(page.getByText('Grouped record', { exact: true })).toBeVisible()
})
