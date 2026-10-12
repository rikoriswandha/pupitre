import { randomUUID } from 'node:crypto'
import { AdminPage, pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'Transmit refreshes another session table and notification tray without polling',
  async ({ admin, page, browser, baseURL, pupitre }) => {
    const observerContext = await browser.newContext({ baseURL })
    const observerPage = await observerContext.newPage()
    await observerPage.clock.install()
    const observer = new AdminPage(observerPage, pupitre)
    const title = `Realtime ${randomUUID()}`
    let recordPath: string | undefined

    try {
      await admin.login()
      await page.getByRole('button', { name: 'Create', exact: true }).first().click()
      await admin.fillField('Title', title)
      await admin.fillField('Slug', title.toLowerCase().replaceAll(' ', '-'))
      await admin.fillField('Category', 'Culture')
      await page.getByRole('button', { name: 'Save post', exact: true }).click()
      await expect(page).toHaveURL(/\/posts\/\d+\/edit/)
      recordPath = new URL(page.url()).pathname.replace(/\/edit$/, '')
      await admin.gotoResource('posts')
      await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(title)
      await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter')
      await expect(admin.row(title)).toBeVisible()
      const subscription = observerPage.waitForResponse((response) => {
        if (!response.url().endsWith('/__transmit/subscribe')) return false
        const payload = response.request().postDataJSON() as { channel?: string }
        return payload.channel?.endsWith('/resources/posts') === true && response.ok()
      })
      await observer.login()
      await subscription
      await observerPage.getByRole('searchbox', { name: 'Search', exact: true }).fill(title)
      await observerPage.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter')
      await expect(observer.row(title)).toBeVisible()
      await observerPage.getByRole('button', { name: 'Notifications', exact: true }).click()
      await expect(observer.row(title).getByRole('combobox', { name: /^Status,/ })).toHaveText(
        'Draft'
      )
      await expect(observerPage.getByText('Loading notifications…', { exact: true })).toHaveCount(0)

      // Freeze browser timers: neither 30-second polling loop can produce these updates.
      await observerPage.clock.pauseAt(new Date(Date.now() + 1_000))
      await admin.openAction('Publish', admin.row(title))
      await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click()
      await admin.submitModal('Publish post')
      await admin.expectToast('Post published')
      const tray = observerPage.getByRole('dialog', { name: 'Notifications' })
      await expect(tray.getByText(title, { exact: true })).toBeVisible()
      await expect
        .poll(
          async () => {
            await observerPage.clock.runFor(100)
            return observer
              .row(title)
              .getByRole('combobox', { name: /^Status,/ })
              .textContent()
          },
          { timeout: 10_000 }
        )
        .toBe('Published')
      await expect(tray.getByText('Post published', { exact: true }).first()).toBeVisible()
    } finally {
      await observerContext.close()
      if (recordPath) {
        await page.goto(`${recordPath}/edit`)
        await admin.openAction('Delete')
        await page
          .getByRole('button', { name: /delete|confirm/i })
          .last()
          .click()
        await expect(page).toHaveURL(/\/posts(?:\?.*)?$/)
      }
    }
  }
)
