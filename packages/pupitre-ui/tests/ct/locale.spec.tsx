import { expect, test } from '@playwright/experimental-ct-react'
import { LocaleDefaultsStory, LocaleMenuStory, LocaleFormStory } from './stories/locale.story.js'

test('user menu posts the selected language to the current tenant panel', async ({
  mount,
  page,
}) => {
  await mount(<LocaleMenuStory />)
  await page.getByRole('button', { name: 'Open user menu' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toBeChecked()
  await page.getByRole('menuitemradio', { name: 'Indonesia', exact: true }).click()
  const payload = await page.getByTestId('locale-switch').textContent()
  expect(JSON.parse(payload!)).toMatchObject({
    url: '/admin/acme/locale',
    method: 'post',
    data: { locale: 'id' },
    preserveScroll: true,
  })
})

test('translated menu switches back to English and marks Indonesian current', async ({
  mount,
  page,
}) => {
  await mount(<LocaleMenuStory locale="id" />)
  await page.getByRole('button', { name: 'Buka menu pengguna' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Indonesia', exact: true })).toBeChecked()
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click()
  const payload = await page.getByTestId('locale-switch').textContent()
  expect(JSON.parse(payload!)).toMatchObject({ method: 'post', data: { locale: 'en' } })
})

test('single-language panels do not offer language switching', async ({ mount, page }) => {
  await mount(<LocaleMenuStory single />)
  await page.getByRole('button', { name: 'Open user menu' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toHaveCount(0)
})

test('default confirmation buttons and empty content use the current dictionary', async ({
  mount,
  page,
}) => {
  await mount(<LocaleDefaultsStory />)
  await expect(page.getByRole('button', { name: 'Konfirmasi', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Batal', exact: true })).toBeVisible()
  await expect(page.getByText('Belum ada konten', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Konfirmasi', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Memproses…', exact: true })).toBeDisabled()
})

test('password disclosure, section collapse and repeater control names follow Indonesian context', async ({
  mount,
  page,
}) => {
  await mount(<LocaleFormStory />)
  const password = page.getByLabel('Kata sandi', { exact: true })
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Tampilkan kata sandi' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Sembunyikan kata sandi' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Sembunyikan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tampilkan', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  await page.getByRole('button', { name: 'Tampilkan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sembunyikan', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true'
  )
  await expect(page.getByText('Butir 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pindahkan Butir 2 ke atas' })).toBeEnabled()
})
