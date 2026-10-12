import { expect, test } from '@playwright/experimental-ct-react'
import { WidgetsStory } from './stories/widgets.story.js'

test('stats styling, table sorting, widget polling, and spans use widget endpoints', async ({
  mount,
}) => {
  const view = await mount(<WidgetsStory />)
  await expect(view.getByText('This month')).toBeVisible()
  await expect(view.getByText('First post')).toBeVisible()
  await expect(view.getByRole('region', { name: 'Monthly posts' })).toBeVisible()
  await expect(view.getByRole('button', { name: /Title/ })).toBeVisible()
  await expect(view.getByText('Compared with last month')).toBeVisible()
  await expect(view.getByText('1280')).toHaveCSS('color', 'rgb(22, 122, 114)')
  await view.getByLabel('Status').selectOption('draft')
  await expect
    .poll(() =>
      view.evaluate(
        () =>
          (window as Window & { __widgetRequests?: string[] }).__widgetRequests?.some((request) =>
            request.includes('filters%5Bstatus%5D=draft')
          ) ?? false
      )
    )
    .toBe(true)

  await view.getByRole('button', { name: /Title/ }).click()
  await expect
    .poll(() =>
      view.evaluate(
        () =>
          (window as Window & { __widgetVisits?: { url: string }[] }).__widgetVisits?.at(-1)?.url ??
          ''
      )
    )
    .toContain('latest-posts%5Bsort%5D=title')
  await expect
    .poll(() =>
      view.evaluate(
        () => (window as Window & { __widgetRequests?: string[] }).__widgetRequests?.length ?? 0
      )
    )
    .toBeGreaterThan(0)
  const requests = await view.evaluate(
    () => (window as Window & { __widgetRequests?: string[] }).__widgetRequests ?? []
  )
  expect(
    requests.every((request) => request.includes('/admin/_pupitre/widgets/latest-posts'))
  ).toBe(true)
})
