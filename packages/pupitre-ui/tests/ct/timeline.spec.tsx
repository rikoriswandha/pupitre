import { expect, test } from '@playwright/experimental-ct-react'
import { AxeBuilder } from '@axe-core/playwright'
import { TimelineCatalogStory, TimelineStory } from './stories/timeline.story.js'

test('timeline grid renders ordered activity, server times, actor and structured changes', async ({
  mount,
  page,
}) => {
  const view = await mount(<TimelineStory />)
  const region = view.getByRole('region', { name: 'Record activity' })
  await expect(region.getByRole('listitem')).toHaveCount(2)
  await expect(region.getByRole('listitem').first()).toContainText('Record updated')
  await expect(region.getByText('Publication approved')).toBeVisible()
  await expect(region.getByText('Ada ·')).toBeVisible()
  await expect(region.locator('time').first()).toHaveAttribute('datetime', '2026-10-11T10:00:00Z')
  await expect(region.locator('time').first()).toHaveText('11 Oct 2026, 10:00')
  await expect(region.getByText('draft', { exact: false })).toBeVisible()
  await expect(region.getByText('published', { exact: false })).toBeVisible()
  await expect(region.getByText('{"approved":true}', { exact: false })).toBeVisible()
  await expect(region.getByRole('table', { name: 'Changes for Record updated' })).toBeVisible()
  await expect(region.getByRole('columnheader', { name: 'Previous value' })).toHaveCount(1)
  await expect(region.getByRole('rowheader', { name: 'status' })).toBeVisible()
  await expect(
    region.getByRole('listitem').last().locator('[aria-hidden="true"]').first()
  ).toHaveCSS('color', 'rgb(22, 122, 114)')
  const results = await new AxeBuilder({ page: page as never }).include('[role="region"]').analyze()
  expect(results.violations).toEqual([])
})

test('timeline renders a readable empty state and deferred skeleton', async ({ mount }) => {
  const view = await mount(<TimelineStory empty />)
  await expect(view.getByText('No activity yet.')).toBeVisible()
  await expect(view.getByRole('list')).toHaveCount(0)
  await view.update(<TimelineStory deferred />)
  await expect(view.locator('[aria-busy="true"]')).toHaveCount(1)
  await expect(view.getByText('No activity yet.')).toHaveCount(0)
})

test('timeline catalog adapter validates and renders its catalog fixture', async ({ mount }) => {
  const view = await mount(<TimelineCatalogStory />)
  await expect(view.getByRole('region', { name: 'Activity' })).toBeVisible()
  await expect(view.getByText('Post updated', { exact: true })).toBeVisible()
  await expect(view.getByText('Ada ·')).toBeVisible()
})
