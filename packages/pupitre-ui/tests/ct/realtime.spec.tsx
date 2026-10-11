import { expect, test } from '@playwright/experimental-ct-react'
import type { Route } from '@playwright/test'
import { RealtimeStory } from './stories/realtime.story.js'

test('push reloads table data and notifications without polling, cleans up and resumes fallback', async ({
  mount,
  page,
}) => {
  await page.clock.install()
  const component = await mount(<RealtimeStory />)
  await expect(page.getByText('Original post')).toBeVisible()
  await page.clock.runFor(3000)
  expect(
    await page.evaluate(
      () => (window as Window & { __realtimeReloads?: unknown[] }).__realtimeReloads
    )
  ).toEqual([])
  await page.evaluate(() => {
    const channel = 'pupitre/admin/resources/posts'
    window.dispatchEvent(new CustomEvent(channel, { detail: { type: 'pupitre:notification' } }))
    window.dispatchEvent(
      new CustomEvent(channel, { detail: { type: 'pupitre:table', resource: 'posts' } })
    )
    window.dispatchEvent(
      new CustomEvent(channel, { detail: { type: 'pupitre:table', resource: 'posts' } })
    )
    window.dispatchEvent(
      new CustomEvent('pupitre/admin/users/1', { detail: { type: 'pupitre:notification' } })
    )
  })
  await page.clock.runFor(10)
  await expect(page.getByText('Updated post')).toBeVisible()
  expect(
    await page.evaluate(
      () => (window as Window & { __realtimeReloads?: unknown[] }).__realtimeReloads
    )
  ).toEqual([{ only: ['pupitre'] }, { only: ['relation_posts'] }])
  await component.update(<RealtimeStory enabled={false} />)
  expect(
    await page.evaluate(() => (window as Window & { __realtimeClosed?: string[] }).__realtimeClosed)
  ).toEqual(expect.arrayContaining(['pupitre/admin/resources/posts', 'pupitre/admin/users/1']))
  await page.clock.runFor(1000)
  expect(
    await page.evaluate(
      () => (window as Window & { __realtimeReloads?: unknown[] }).__realtimeReloads?.length
    )
  ).toBe(4)
  await component.unmount()
  await page.clock.runFor(2000)
  expect(
    await page.evaluate(
      () => (window as Window & { __realtimeReloads?: unknown[] }).__realtimeReloads?.length
    )
  ).toBe(4)
})

test('an open tray refreshes pushed inbox items without duplicate subscriptions or stale fetches', async ({
  mount,
  page,
}) => {
  let requests = 0
  let held: Route | undefined
  await page.route('**/notifications?page=1', async (route) => {
    requests++
    if (requests === 2) {
      held = route
      return
    }
    await route.fulfill({
      json: {
        items: [
          {
            id: String(requests),
            type: 'success',
            title: requests === 1 ? 'Initial inbox' : 'Pushed inbox',
            readAt: null,
            createdAt: '2026-10-11T00:00:00.000Z',
          },
        ],
        unread: 1,
        meta: { total: 1, perPage: 20, currentPage: 1, lastPage: 1 },
      },
    })
  })
  const component = await mount(<RealtimeStory />)
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await expect(page.getByText('Initial inbox')).toBeVisible()
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('pupitre/admin/users/1', { detail: { type: 'pupitre:notification' } })
    )
  )
  await expect.poll(() => requests).toBe(2)
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('pupitre/admin/users/1', { detail: { type: 'pupitre:notification' } })
    )
  )
  await expect(page.getByText('Pushed inbox')).toBeVisible()
  await held?.fulfill({
    json: { items: [], unread: 0, meta: { total: 0, perPage: 20, currentPage: 1, lastPage: 1 } },
  })
  await expect(page.getByText('Pushed inbox')).toBeVisible()
  expect(requests).toBe(3)
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __realtimeReloads?: unknown[] }).__realtimeReloads?.filter(
          (entry) => JSON.stringify(entry) === JSON.stringify({ only: ['pupitre'] })
        ).length
    )
  ).toBe(2)
  await component.unmount()
})

test('notification item focus survives an in-flight and completed ping refresh', async ({
  mount,
  page,
}) => {
  let requests = 0
  let finishRefresh: (() => void) | undefined
  const refreshReady = new Promise<void>((resolve) => {
    finishRefresh = resolve
  })
  await page.route('**/notifications?page=1', async (route) => {
    requests++
    if (requests > 1) await refreshReady
    await route.fulfill({
      json: {
        items: [
          {
            id: 'stable-item',
            type: 'success',
            title: requests === 1 ? 'Initial notification' : 'Updated notification',
            url: '/admin/posts/1',
            readAt: null,
            createdAt: '2026-10-11T00:00:00.000Z',
          },
        ],
        unread: 1,
        meta: { total: 1, perPage: 20, currentPage: 1, lastPage: 1 },
      },
    })
  })
  await mount(<RealtimeStory />)
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  const item = page.getByRole('link', { name: 'Initial notification', exact: true })
  await item.focus()
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('pupitre/admin/users/1', { detail: { type: 'pupitre:notification' } })
    )
  )
  await expect.poll(() => requests).toBe(2)
  await expect(page.locator('[aria-busy="true"]')).toBeVisible()
  await expect(item).toBeVisible()
  await expect(item).toBeFocused()
  await expect(page.getByText('Loading notifications…')).toHaveCount(0)
  finishRefresh!()
  await expect(page.getByRole('link', { name: 'Updated notification', exact: true })).toBeFocused()
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
})
