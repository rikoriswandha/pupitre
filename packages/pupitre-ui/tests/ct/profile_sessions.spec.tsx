import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { ProfileSessions } from '../../src/components/ProfileSessions.js'

for (const theme of ['light', 'dark']) {
  test(`browser sessions and recent logins are accessible in ${theme}`, async ({ mount, page }) => {
    await page.route('**/admin/profile/sessions', (route) =>
      route.fulfill({
        json: {
          sessions: [
            {
              id: 'current',
              browser: 'Firefox',
              device: 'macOS',
              ip: '127.0.0.1',
              lastActiveAt: '2026-10-13T10:00:00Z',
              current: true,
            },
            {
              id: 'other',
              browser: 'Chrome',
              device: 'Windows',
              ip: '192.0.2.1',
              lastActiveAt: '2026-10-13T09:00:00Z',
              current: false,
            },
          ],
          events: [
            {
              event: 'login',
              method: 'password',
              ip: '127.0.0.1',
              created_at: '2026-10-13T10:00:00Z',
            },
          ],
        },
      })
    )
    await page.evaluate(
      (value) => document.documentElement.classList.toggle('dark', value === 'dark'),
      theme
    )
    await mount(
      <div className="min-h-screen bg-background p-6 text-foreground">
        <ProfileSessions basePath="/admin" hasPassword passkeysEnabled={false} history />
      </div>
    )
    await expect(page.getByText('Current session', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent logins' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Log out other browser sessions' })
    ).toBeDisabled()
    await page.getByLabel('Current password').fill('password')
    const password = page.getByLabel('Current password')
    await expect(password).toHaveClass(/h-\(--control-h\)/)
    const height = await password.evaluate((input) => input.getBoundingClientRect().height)
    expect(height).toBeGreaterThanOrEqual(32)
    await expect(
      page.getByRole('list', { name: 'Browser sessions', exact: true }).getByRole('listitem')
    ).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Log out other browser sessions' })).toBeEnabled()
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished))
    )
    const audit = await new AxeBuilder({ page: page as never })
      .exclude('[data-base-ui-focus-guard]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(audit.violations).toEqual([])
  })
}
