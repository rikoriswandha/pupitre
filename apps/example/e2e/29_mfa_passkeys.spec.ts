import { generate } from 'otplib'
import type { Page } from '@playwright/test'
import { expect, pupitreTest } from '@rikology/pupitre-ui/testing'

async function csrfHeaders(page: Page) {
  const cookies = await page.context().cookies(page.url())
  const token = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  return { 'X-XSRF-TOKEN': decodeURIComponent(token) }
}

pupitreTest('MFA enrollment, TOTP login, and recovery code are one-time', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('mfa@example.com')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/acme$/)
  const setup = await page.request.post('/admin/profile/mfa/setup', {
    headers: await csrfHeaders(page),
  })
  expect(setup.ok()).toBeTruthy()
  expect(setup.headers()['content-type']).toContain('application/json')
  const enrollment = (await setup.json()) as { secret: string; qrCode: string }
  expect(enrollment.qrCode).toMatch(/^data:image\/png;base64,/)
  const code = await generate({ secret: enrollment.secret })
  const confirmation = await page.request.post('/admin/profile/mfa/confirm', {
    data: { code },
    headers: await csrfHeaders(page),
  })
  expect(confirmation.ok()).toBeTruthy()
  const { recoveryCodes } = (await confirmation.json()) as { recoveryCodes: string[] }
  expect(recoveryCodes).toHaveLength(10)

  const logout = await page.request.post('/admin/logout', { headers: await csrfHeaders(page) })
  expect(logout.ok()).toBeTruthy()
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('mfa@example.com')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/mfa\/challenge$/)
  await page
    .getByLabel('Authenticator code or recovery code')
    .fill(await generate({ secret: enrollment.secret }))
  await page.getByRole('button', { name: 'Multi-factor authentication' }).click()
  await expect(page).toHaveURL(/\/admin\/acme$/)

  await page.request.post('/admin/logout', { headers: await csrfHeaders(page) })
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('mfa@example.com')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Authenticator code or recovery code').fill(recoveryCodes[0]!)
  await page.getByRole('button', { name: 'Multi-factor authentication' }).click()
  await expect(page).toHaveURL(/\/admin\/acme$/)

  await page.request.post('/admin/logout', { headers: await csrfHeaders(page) })
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('mfa@example.com')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Authenticator code or recovery code').fill(recoveryCodes[0]!)
  await page.getByRole('button', { name: 'Multi-factor authentication' }).click()
  await expect(page.getByText('The code is invalid or expired')).toBeVisible()
})

pupitreTest('registers and uses a passkey with a virtual authenticator', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  try {
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('admin@example.com')
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/acme$/)
    await page.goto('/admin/profile')
    await page.getByLabel('Passkey name').fill('E2E virtual authenticator')
    await page.getByRole('button', { name: 'Register passkey' }).click()
    await expect(page.getByText('E2E virtual authenticator')).toBeVisible()

    await page.request.post('/admin/logout', { headers: await csrfHeaders(page) })
    await page.goto('/admin/login')
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
    await expect(page).toHaveURL(/\/admin\/acme$/)
  } finally {
    try {
      if (!page.isClosed())
        await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId })
    } finally {
      await cdp.detach().catch(() => {})
    }
  }
})
