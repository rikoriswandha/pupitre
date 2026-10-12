import { test, expect } from '@playwright/experimental-ct-react'
import { TableInteractStory } from './stories/table_interact.story.js'

for (const success of [true, false]) {
  test(`refresh while inline PATCH is pending preserves the edit and handles ${success ? 'success' : 'failure'}`, async ({
    mount,
    page,
  }) => {
    const view = await mount(<TableInteractStory deferred />)
    await view.getByRole('button', { name: /Edit Title, Hello, row 10/ }).click()
    await view.getByRole('textbox', { name: 'Title, row 10' }).fill('client edit')
    await view.getByRole('textbox', { name: 'Title, row 10' }).press('Enter')
    await expect
      .poll(() =>
        page.evaluate(
          () => typeof (window as Window & { __settleTableEdit?: unknown }).__settleTableEdit
        )
      )
      .toBe('function')
    await view.update(<TableInteractStory deferred freshTitle="fresh server" />)
    await expect(view.getByRole('textbox', { name: 'Title, row 10' })).toHaveValue('client edit')
    await page.evaluate((ok) => {
      ;(window as Window & { __settleTableEdit?: (result: boolean) => void }).__settleTableEdit!(ok)
    }, success)
    const expected = success ? 'client edit' : 'fresh server'
    const button = view.getByRole('button', { name: `Edit Title, ${expected}, row 10` })
    await expect(button).toHaveText(expected)
    await button.click()
    await expect(view.getByRole('textbox', { name: 'Title, row 10' })).toHaveValue(expected)
    await view.getByRole('textbox', { name: 'Title, row 10' }).press('Escape')
    await view.update(<TableInteractStory deferred freshTitle="next server" />)
    await expect(view.getByRole('button', { name: 'Edit Title, next server, row 10' })).toHaveText(
      'next server'
    )
  })
}

for (const olderValue of ['Hello', 'client edit']) {
  for (const laterValue of ['another user', 'Hello']) {
    test(`GET before PATCH settlement (${olderValue}) preserves the save; later GET (${laterValue}) wins`, async ({
      mount,
      page,
    }) => {
      const view = await mount(<TableInteractStory deferred />)
      await expect(view.getByRole('button', { name: 'Edit Title, Hello, row 10' })).toBeVisible()
      await page.evaluate(() => {
        ;(window as Window & { __tableRefresh?: () => number }).__tableRefresh!()
      })
      await view.getByRole('button', { name: 'Edit Title, Hello, row 10' }).click()
      const input = view.getByRole('textbox', { name: 'Title, row 10' })
      await input.fill('client edit')
      await input.press('Enter')
      await expect
        .poll(() =>
          page.evaluate(
            () => typeof (window as Window & { __settleTableEdit?: unknown }).__settleTableEdit
          )
        )
        .toBe('function')
      await page.evaluate(() => {
        ;(window as Window & { __settleTableEdit?: (ok: boolean) => void }).__settleTableEdit!(true)
      })
      await expect(
        view.getByRole('button', { name: 'Edit Title, client edit, row 10' })
      ).toBeVisible()
      // Inertia swaps props before emitting success for the matching visit.
      await view.update(<TableInteractStory deferred freshTitle={olderValue} />)
      await page.evaluate((title) => {
        ;(window as Window & { __tableRefresh?: (title?: string) => number }).__tableRefresh!(title)
      }, olderValue)
      await expect(
        view.getByRole('button', { name: 'Edit Title, client edit, row 10' })
      ).toBeVisible()
      await page.evaluate(() => {
        ;(window as Window & { __tableRefresh?: () => number }).__tableRefresh!()
      })
      await view.update(<TableInteractStory deferred freshTitle={laterValue} />)
      await page.evaluate((title) => {
        const refresh = (window as Window & { __tableRefresh?: (title?: string) => number })
          .__tableRefresh!
        refresh(title)
      }, laterValue)
      await expect(
        view.getByRole('button', { name: `Edit Title, ${laterValue}, row 10` })
      ).toBeVisible()
    })
  }
}

test('a later refresh wins even while an older request is outstanding', async ({ mount, page }) => {
  const view = await mount(<TableInteractStory deferred />)
  await expect(view.getByRole('button', { name: 'Edit Title, Hello, row 10' })).toBeVisible()
  await page.evaluate(() => {
    ;(window as Window & { __tableRefresh?: () => number }).__tableRefresh!()
  })
  await view.getByRole('button', { name: 'Edit Title, Hello, row 10' }).click()
  await view.getByRole('textbox', { name: 'Title, row 10' }).fill('client edit')
  await view.getByRole('textbox', { name: 'Title, row 10' }).press('Enter')
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as Window & { __settleTableEdit?: unknown }).__settleTableEdit
      )
    )
    .toBe('function')
  await page.evaluate(() => {
    ;(window as Window & { __settleTableEdit?: (ok: boolean) => void }).__settleTableEdit!(true)
  })
  await expect(view.getByRole('button', { name: 'Edit Title, client edit, row 10' })).toBeVisible()
  await page.evaluate(() => {
    ;(window as Window & { __tableRefresh?: () => number }).__tableRefresh!()
  })
  // Inertia swaps props before emitting success; an older GET remains outstanding.
  await view.update(<TableInteractStory deferred freshTitle="another user" />)
  await page.evaluate(() => {
    ;(window as Window & { __tableRefresh?: (title?: string, id?: number) => number })
      .__tableRefresh!('another user', 2)
  })
  await expect(view.getByRole('button', { name: 'Edit Title, another user, row 10' })).toBeVisible()
})

test('stale GET during a failed re-edit rolls back to the previously saved value', async ({
  mount,
  page,
}) => {
  const view = await mount(<TableInteractStory deferred />)
  await expect(view.getByRole('button', { name: 'Edit Title, Hello, row 10' })).toBeVisible()
  await page.evaluate(() => {
    ;(window as Window & { __tableRefresh?: () => number }).__tableRefresh!()
  })
  await view.getByRole('button', { name: 'Edit Title, Hello, row 10' }).click()
  const input = view.getByRole('textbox', { name: 'Title, row 10' })
  await input.fill('saved A')
  await input.press('Enter')
  await page.evaluate(() => {
    ;(window as Window & { __settleTableEdit?: (ok: boolean) => void }).__settleTableEdit!(true)
  })
  await view.getByRole('button', { name: 'Edit Title, saved A, row 10' }).click()
  await input.fill('pending B')
  await input.press('Enter')
  await view.update(<TableInteractStory deferred freshTitle="stale server" />)
  await page.evaluate(() => {
    ;(window as Window & { __tableRefresh?: (title?: string) => number }).__tableRefresh!(
      'stale server'
    )
  })
  await expect(input).toHaveValue('pending B')
  await page.evaluate(() => {
    ;(window as Window & { __settleTableEdit?: (ok: boolean) => void }).__settleTableEdit!(false)
  })
  await expect(view.getByRole('button', { name: 'Edit Title, saved A, row 10' })).toBeVisible()
})

test('prop-only data after a landed GET releases a settled override', async ({ mount, page }) => {
  const view = await mount(<TableInteractStory deferred />)
  await expect(view.getByRole('button', { name: 'Edit Title, Hello, row 10' })).toBeVisible()
  await page.evaluate(() => {
    const refresh = (window as Window & { __tableRefresh?: (title?: string) => number })
      .__tableRefresh!
    refresh()
    refresh('Hello')
  })
  await view.getByRole('button', { name: 'Edit Title, Hello, row 10' }).click()
  const input = view.getByRole('textbox', { name: 'Title, row 10' })
  await input.fill('saved A')
  await input.press('Enter')
  await page.evaluate(() => {
    ;(window as Window & { __settleTableEdit?: (ok: boolean) => void }).__settleTableEdit!(true)
  })
  await expect(view.getByRole('button', { name: 'Edit Title, saved A, row 10' })).toBeVisible()
  await view.update(<TableInteractStory deferred freshTitle="host update" />)
  await expect(view.getByRole('button', { name: 'Edit Title, host update, row 10' })).toBeVisible()
})

test('a visit cancelled in before does not block later prop-only releases', async ({
  mount,
  page,
}) => {
  const view = await mount(<TableInteractStory deferred />)
  await expect(view.getByRole('button', { name: 'Edit Title, Hello, row 10' })).toBeVisible()
  await page.evaluate(() => {
    ;(window as Window & { __cancelTableRefresh?: () => void }).__cancelTableRefresh!()
  })
  await view.getByRole('button', { name: 'Edit Title, Hello, row 10' }).click()
  const input = view.getByRole('textbox', { name: 'Title, row 10' })
  await input.fill('saved A')
  await input.press('Enter')
  await page.evaluate(() => {
    ;(window as Window & { __settleTableEdit?: (ok: boolean) => void }).__settleTableEdit!(true)
  })
  await expect(view.getByRole('button', { name: 'Edit Title, saved A, row 10' })).toBeVisible()
  await view.update(<TableInteractStory deferred freshTitle="host update" />)
  await expect(view.getByRole('button', { name: 'Edit Title, host update, row 10' })).toBeVisible()
})

for (const density of ['compact', 'comfortable'] as const) {
  for (const controlType of ['toggle', 'checkbox'] as const) {
    test(`inline ${controlType} keeps text-only row geometry in ${density} density`, async ({
      mount,
    }) => {
      const view = await mount(
        <TableInteractStory textOnly controlType={controlType} layout="table" density={density} />
      )
      const row = view.locator('tbody tr').first()
      const height = await row.evaluate((element) => element.getBoundingClientRect().height)
      // Measured with the HEAD editable-cell component: switch 40/48, checkbox 38/46.
      expect(height).toBe(
        (controlType === 'toggle' ? 40 : 38) + (density === 'comfortable' ? 8 : 0)
      )
      const target = view.getByRole(controlType === 'toggle' ? 'switch' : 'checkbox', {
        name: 'Featured, row 10',
        exact: true,
      })
      const box = await target.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(24)
      expect(box!.width).toBeGreaterThanOrEqual(24)
    })
  }
}

for (const density of ['compact', 'comfortable'] as const) {
  test(`table controls keep row geometry in ${density} density`, async ({ mount, page }) => {
    const view = await mount(<TableInteractStory selectable layout="table" density={density} />)
    const row = view.locator('tbody tr').first()
    await expect
      .poll(() => row.evaluate((element) => element.getBoundingClientRect().height))
      .toBe(density === 'compact' ? 49 : 57)
    await view.getByRole('button', { name: 'Columns', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Featured', exact: true }).check()
    await view.getByRole('button', { name: 'Columns', exact: true }).click()
    for (const control of [
      view.getByRole('checkbox', { name: 'Select all rows', exact: true }),
      view.getByRole('checkbox', { name: 'Select row 10', exact: true }),
      view.getByRole('switch', { name: 'Featured, row 10', exact: true }),
    ]) {
      const box = await control.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(24)
      expect(box!.height).toBeGreaterThanOrEqual(24)
    }
    await expect(
      view.getByRole('checkbox', { name: 'Select row 10', exact: true }).locator('span').first()
    ).toHaveCSS('width', '16px')
    const track = await view
      .getByRole('switch', { name: 'Featured, row 10', exact: true })
      .evaluate((element) => {
        const visual = getComputedStyle(element, '::before')
        return { height: visual.height, width: visual.width }
      })
    expect(track).toEqual({ height: '20px', width: '36px' })
    await expect
      .poll(() => row.evaluate((element) => element.getBoundingClientRect().height))
      .toBe(density === 'compact' ? 49 : 57)
    await view.update(<TableInteractStory selectable layout="grid" density={density} />)
    const box = await view
      .getByRole('checkbox', { name: 'Select row 10', exact: true })
      .boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(24)
    expect(box!.height).toBeGreaterThanOrEqual(24)
  })
}
