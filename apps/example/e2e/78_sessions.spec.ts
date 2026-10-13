import { test, expect } from '@playwright/test'

test('revoking another browser session logs it out on its next request', async ({
  browser,
  baseURL,
}) => {
  // Reproduce the full-suite history: closing a browser does not revoke its server row.
  for (let index = 0; index < 21; index++) {
    const prior = await browser.newContext({ baseURL })
    try {
      await prior.request.get('/admin/login')
      const priorCookies = await prior.cookies()
      const csrf = priorCookies.find((cookie) => cookie.name === 'XSRF-TOKEN')
      const response = await prior.request.post('/admin/login', {
        form: { email: 'admin@example.com', password: 'password' },
        headers: { 'X-XSRF-TOKEN': decodeURIComponent(csrf?.value ?? '') },
      })
      expect(response.ok()).toBeTruthy()
    } finally {
      await prior.close()
    }
  }
  const first = await browser.newContext({ baseURL })
  const second = await browser.newContext({ baseURL })
  try {
    const owner = await first.newPage()
    const other = await second.newPage()
    for (const page of [owner, other]) {
      // Isolated dev runs must not reload on unrelated workspace edits.
      await page.routeWebSocket('**', (socket) => socket.close())
      await page.goto('/admin/login')
      await page.getByLabel('Email').fill('admin@example.com')
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.waitForURL((url) => !url.pathname.includes('/login'))
    }
    const sessions = await other.request.get('/admin/profile/sessions')
    const payload = await sessions.json()
    const otherSession = payload.sessions.find((session: { current: boolean }) => session.current)
    expect(otherSession).toBeDefined()
    await owner.goto('/admin/profile')
    await expect(
      owner.getByRole('heading', { name: 'Browser sessions', exact: true })
    ).toBeVisible()
    const otherRow = owner
      .getByRole('list', { name: 'Browser sessions', exact: true })
      .locator(`[data-session-id="${otherSession.id}"]`)
    await expect(otherRow).toBeVisible()
    await otherRow.getByRole('button', { name: 'Revoke session', exact: true }).click()
    await expect(otherRow).toHaveCount(0)
    await other.goto('/admin/acme/posts')
    await expect(other).toHaveURL(/\/admin\/login/)
    await expect(other.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
    await owner.reload()
    await expect(owner.getByText('Current session', { exact: true })).toBeVisible()
  } finally {
    await first.close()
    await second.close()
  }
})
