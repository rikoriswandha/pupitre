import { expect, type Locator, type Page } from '@playwright/test'

export class AdminPage {
  constructor(readonly page: Page) {}

  static readonly tenantPath = '/admin/acme'
  url(path: string) {
    return `${AdminPage.tenantPath}${path.startsWith('/') ? path : `/${path}`}`
  }

  async login(email = 'admin@example.com') {
    await this.page.goto(
      `/admin/login?redirect=${encodeURIComponent(`${AdminPage.tenantPath}/posts`)}`
    )
    await this.page.getByLabel('Email').fill(email)
    await this.page.getByLabel('Password').fill('password')
    await this.page.getByRole('button', { name: 'Sign in' }).click()
    await this.page.waitForURL(`**${AdminPage.tenantPath}/posts`)
    await expect(this.postRow('Field Notes 01')).toBeVisible()
  }

  async fillField(label: string, value: string | number) {
    const dialogField = this.page.getByRole('dialog').getByLabel(label, { exact: false }).first()
    const field =
      (await dialogField.count()) > 0
        ? dialogField
        : this.page.getByLabel(label, { exact: false }).first()
    const control = await field.evaluate((element) => {
      const fieldElement = element as unknown as { tagName: string }
      return fieldElement.tagName
    })
    if (control === 'SELECT') {
      await field.selectOption(String(value))
      return
    }
    const asyncOptions = await field.getAttribute('data-options-search')
    if (asyncOptions !== null) {
      await field.click()
      await field.fill(String(value))
      await this.page.getByRole('option', { name: String(value), exact: true }).click()
      return
    }
    const role = await field.getAttribute('role')
    if (role === 'combobox' || control === 'BUTTON') {
      await field.click()
      const search = this.page.getByRole('textbox', { name: 'Search options' }).last()
      if (await search.isVisible().catch(() => false)) await search.fill(String(value))
      await this.page.getByRole('option', { name: String(value), exact: true }).click()
      return
    }
    await field.fill(String(value))
  }

  async openAction(name: string, row?: Locator) {
    const scope = row ?? this.page
    await scope.getByRole('button', { name, exact: true }).click()
  }

  async expectToast(message: string) {
    await expect(this.page.getByText(message, { exact: false }).last()).toBeVisible()
  }

  postRow(title: string) {
    return this.page.getByRole('row').filter({ hasText: title })
  }
}
