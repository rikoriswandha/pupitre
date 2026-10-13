import { expect, test } from '@playwright/experimental-ct-react'
import {
  WidgetPackingStory,
  WidgetReconciliationStory,
  WidgetSemanticColorsStory,
} from './stories/widgets_reconciliation.story.js'

test('context polling consumes dataUrl and reconciles fresh props without resetting other polled values', async ({
  mount,
  page,
}) => {
  await page.clock.install()
  await page.clock.pauseAt(new Date())
  await page.evaluate(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('filters[status]', 'draft')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  })
  const requests: URL[] = []
  await page.route('**/admin/_pupitre/widgets/**', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    await route.fulfill({
      json: url.pathname.endsWith('/count')
        ? { kind: 'stats', stats: [{ label: 'Count', value: 'Polled count' }] }
        : { kind: 'component', data: { message: 'Polled custom' } },
    })
  })
  const view = await mount(<WidgetReconciliationStory />)
  await expect(view.getByText('Initial count', { exact: true })).toBeVisible()
  await expect(view.getByText('Initial custom', { exact: true })).toBeVisible()
  await page.clock.runFor(100)
  await expect(view.getByText('Polled count', { exact: true })).toBeVisible()
  await expect(view.getByText('Polled custom', { exact: true })).toBeVisible()
  expect(requests).toHaveLength(2)
  const listRequest = requests.find((url) => url.pathname.endsWith('/count'))!
  const customRequest = requests.find((url) => url.pathname.endsWith('/report'))!
  expect(listRequest.searchParams.get('resource')).toBe('posts')
  expect(listRequest.searchParams.get('widgetPage')).toBe('list')
  expect(customRequest.searchParams.get('customPage')).toBe('reports')
  for (const request of requests) expect(request.searchParams.get('filters[status]')).toBe('draft')

  await view.getByRole('button', { name: 'Rerender wrapper' }).click()
  await expect(view.getByText('Revision 1', { exact: true })).toBeVisible()
  await expect(view.getByText('Polled count', { exact: true })).toBeVisible()
  await expect(view.getByText('Polled custom', { exact: true })).toBeVisible()
  await view.getByRole('button', { name: 'Update count prop' }).click()
  await expect(view.getByText('Fresh count', { exact: true })).toBeVisible()
  await expect(view.getByText('Polled custom', { exact: true })).toBeVisible()
  await view.getByRole('button', { name: 'Rerender wrapper' }).click()
  await expect(view.getByText('Revision 2', { exact: true })).toBeVisible()
  await expect(view.getByText('Fresh count', { exact: true })).toBeVisible()
  await expect(view.getByText('Polled custom', { exact: true })).toBeVisible()
})

test('stats semantic colors use theme classes while raw CSS colors remain supported', async ({
  mount,
}) => {
  const view = await mount(<WidgetSemanticColorsStory />)
  for (const color of ['primary', 'success', 'warning', 'danger', 'gray']) {
    const value = view.getByText(`${color} value`, { exact: true })
    await expect(value).toBeVisible()
    expect(await value.evaluate((element) => (element as HTMLElement).style.color)).toBe('')
  }
  await expect(view.getByText('#167a72 value', { exact: true })).toHaveCSS(
    'color',
    'rgb(22, 122, 114)'
  )
  await expect(view.getByText('rebeccapurple value', { exact: true })).toHaveCSS(
    'color',
    'rgb(102, 51, 153)'
  )
})

test('widget rows that would leave empty columns stretch to fill the grid', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  const view = await mount(<WidgetPackingStory />)
  const widths = await view.evaluate(() =>
    Array.from({ length: 6 }, (_, index) =>
      Math.round(
        document
          .querySelector(`[data-testid="widget-${index}"]`)!
          .parentElement!.getBoundingClientRect().width
      )
    )
  )
  // 1200px grid, 12 tracks, 32px gaps: halves 584, a [2, 1] row 789/379, full 1200.
  expect(widths).toEqual([584, 584, 1200, 789, 379, 1200])
})
