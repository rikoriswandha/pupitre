import { test, expect } from '@playwright/experimental-ct-react'
import { TableInteractStory } from './stories/table_interact.story.js'

test('editable cells revert on validation failure and send PATCH requests', async ({
  mount,
  page,
}) => {
  const view = await mount(<TableInteractStory />)
  await view.getByRole('button', { name: /Edit Title, Hello, row 10/ }).click()
  const input = view.getByRole('textbox', { name: 'Title, row 10' })
  await expect(input).toHaveValue('Hello')
  await input.fill('invalid')
  await input.press('Enter')
  const editButton = view.getByRole('button', { name: /Edit Title, Hello, row 10/ })
  await expect(editButton).toContainText('Hello')
  await expect(editButton).toBeFocused()
  await editButton.click()
  const reopened = view.getByRole('textbox', { name: 'Title, row 10' })
  await expect(reopened).toHaveValue('Hello')
  await reopened.fill('discard me')
  await reopened.press('Escape')
  await expect(editButton).toBeFocused()
  await view.getByRole('button', { name: 'Columns', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Featured', exact: true }).check()
  await view.getByRole('button', { name: 'Columns', exact: true }).click()
  const featured = view.getByRole('switch', { name: 'Featured, row 10', exact: true })
  await expect(featured).toHaveCount(1)
  await featured.check()
  await featured.click()
  await expect(featured).toBeChecked()
  await expect
    .poll(() =>
      view.evaluate(
        () =>
          (window as Window & { __tableToasts?: { title: string }[] }).__tableToasts?.some(
            (toast) => toast.title === 'Unable to save this value'
          ) ?? false
      )
    )
    .toBeTruthy()
  await expect
    .poll(() =>
      view.evaluate(
        () =>
          (window as Window & { __tableRequests?: { method: string }[] }).__tableRequests?.filter(
            (request) => request.method === 'PATCH'
          ).length ?? 0
      )
    )
    .toBeGreaterThan(1)
})

test('grid layout, visibility persistence, deferred filters, keyboard reorder, and polling work', async ({
  mount,
  page,
}) => {
  const view = await mount(<TableInteractStory />)
  await expect(view.locator('.pupitre-table-grid article')).toHaveCount(2)
  const grid = view.locator('.pupitre-table-grid')
  const gridColumnCount = await grid.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
  )
  expect(gridColumnCount).toBeGreaterThan(1)

  await view.getByRole('button', { name: 'Reorder' }).click()
  await view.getByRole('button', { name: 'Move 10 down' }).click()
  await expect
    .poll(() =>
      view.evaluate(
        () =>
          (window as Window & { __tableRequests?: unknown[] }).__tableRequests?.some((request) =>
            JSON.stringify(request).includes('POST')
          ) ?? false
      )
    )
    .toBeTruthy()
  await view.getByRole('button', { name: 'Done reordering' }).click()

  const reloadCount = await page.evaluate(
    () => (window as Window & { __tableReloads?: unknown[] }).__tableReloads?.length ?? 0
  )
  await page.waitForTimeout(80)
  await expect
    .poll(() =>
      page.evaluate(
        (since) =>
          (window as Window & { __tableReloads?: unknown[] }).__tableReloads
            ?.slice(since)
            .some((call) => JSON.stringify(call).includes('"only":["data"]')) ?? false,
        reloadCount
      )
    )
    .toBeTruthy()

  const visits = () =>
    view.evaluate(
      () => (window as Window & { __tableVisits?: unknown[] }).__tableVisits?.length ?? 0
    )
  const beforeFilter = await visits()
  await view.getByRole('combobox', { name: 'Filter Status', exact: true }).click()
  await page.getByRole('option', { name: 'Draft', exact: true }).click()
  expect(await visits()).toBe(beforeFilter)
  await view.getByRole('button', { name: 'Apply' }).click()
  await expect.poll(visits).toBeGreaterThan(beforeFilter)

  await view.getByRole('button', { name: 'Columns', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Featured', exact: true }).check()
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('pupitre:columns:table-interact')))
    .toContain('"isFeatured":true')
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __tableReloads?: unknown[] }).__tableReloads?.length ?? 0
      )
    )
    .toBeGreaterThan(0)
})
test('reorders the visible page window using its global pagination offset', async ({ mount }) => {
  const view = await mount(<TableInteractStory pageTwo />)
  await view.getByRole('button', { name: 'Reorder' }).click()
  await view.getByRole('button', { name: 'Move 10 down' }).click()
  await expect
    .poll(() =>
      view.evaluate(() => {
        const requests =
          (window as Window & { __tableRequests?: { body: string }[] }).__tableRequests ?? []
        const request = requests.find((item) => {
          try {
            return JSON.parse(item.body).offset === 1
          } catch {
            return false
          }
        })
        return request ? JSON.parse(request.body).offset : null
      })
    )
    .toBe(1)
})

test('blur-save does not steal focus and fresh rows replace optimistic edits', async ({
  mount,
}) => {
  const view = await mount(<TableInteractStory />)
  await view.getByRole('button', { name: /Edit Title, Hello, row 10/ }).click()
  await view.getByRole('textbox', { name: 'Title, row 10' }).fill('client edit')
  await view.getByRole('button', { name: /Edit Title, Second, row 11/ }).click()
  const second = view.getByRole('textbox', { name: 'Title, row 11' })
  await second.fill('still typing')
  await expect(view.getByRole('button', { name: /Edit Title, client edit, row 10/ })).toBeVisible()
  await expect(second).toBeFocused()
  await expect(second).toHaveValue('still typing')
  await second.press('Escape')
  await view.update(<TableInteractStory freshTitle="server normalized" />)
  await view.getByRole('button', { name: /Edit Title, server normalized, row 10/ }).click()
  await expect(view.getByRole('textbox', { name: 'Title, row 10' })).toHaveValue(
    'server normalized'
  )
})
