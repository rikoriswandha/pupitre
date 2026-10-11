import { expect, test } from '@playwright/experimental-ct-react'
import { ProfileSecurity } from '../../src/components/ProfileSecurity.js'

test('enrolls TOTP and presents recovery codes only in the confirmation result', async ({
  mount,
  page,
}) => {
  await page.route('**/admin/profile/mfa/setup', (route) =>
    route.fulfill({ json: { secret: 'ABC123', qrCode: 'data:image/png;base64,ZmFrZQ==' } })
  )
  await page.route('**/admin/profile/mfa/confirm', (route) =>
    route.fulfill({ json: { recoveryCodes: ['once-code-1', 'once-code-2'] } })
  )
  await mount(<ProfileSecurity basePath="/admin" mfaEnabled={false} passkeysEnabled={false} />)
  await page.getByRole('button', { name: 'Set up MFA' }).click()
  await expect(
    page.getByRole('img', { name: 'Scan this QR code with your authenticator app' })
  ).toHaveAttribute('src', 'data:image/png;base64,ZmFrZQ==')
  await expect(page.getByText('ABC123')).toBeVisible()
  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Confirm and enable' }).click()
  await expect(page.getByRole('heading', { name: 'Save these recovery codes now' })).toBeVisible()
  await expect(page.getByText('once-code-1')).toBeVisible()
  await page.getByRole('button', { name: 'I have saved these codes' }).click()
  await expect(page.getByText('once-code-1')).not.toBeVisible()
})
