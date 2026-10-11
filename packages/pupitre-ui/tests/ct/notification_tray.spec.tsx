import { test, expect } from '@playwright/experimental-ct-react'
import { NotificationTrayStory } from './stories/notification_tray.story.js'

test('opens the inbox, shows notifications, and marks all read', async ({ mount, page }) => {
  await mount(<NotificationTrayStory />)
  await page.getByRole('button', { name: 'Notifications' }).click()
  await expect(page.getByText('Post published')).toBeVisible()
  await expect(page.getByText('Field Notes 03 is live')).toBeVisible()
  const markAll = page.getByRole('button', { name: 'Mark all read' })
  await markAll.click()
  const requestLog = page.getByTestId('notification-requests')
  await expect
    .poll(async () => JSON.parse((await requestLog.textContent()) ?? '[]'))
    .toContainEqual({
      method: 'POST',
      url: '/admin/_pupitre/notifications/read',
      body: '{"ids":"all"}',
      xsrf: 'ct-token',
    })
  await expect(page.getByText('Post published')).toBeVisible()
  await expect(page.locator('button[aria-label="Notifications"] span')).toHaveCount(0)
})
