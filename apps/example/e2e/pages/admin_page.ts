import { expect, type Locator, type Page } from '@playwright/test'

export class AdminPage {
  constructor(readonly page: Page) {}

  async login() {
    await this.page.goto('/login')
    await this.page.getByLabel('Email').fill('admin@example.com')
    await this.page.getByLabel('Password').fill('password')
    await this.page.getByRole('button', { name: 'Sign in' }).click()
    await this.page.waitForURL('**/dashboard')
    await this.page.goto('/admin/posts')
    await expect(this.postRow('Field Notes 01')).toBeVisible()
  }

  async fillField(label: string, value: string | number) {
    const field = this.page.getByLabel(label, { exact: false }).first()
    const control = await field.evaluate((element) => {
      const fieldElement = element as unknown as { tagName: string }
      return fieldElement.tagName
    })
    if (control === 'SELECT') {
      await field.selectOption(String(value))
      return
    }
    const role = await field.getAttribute('role')
    if (role === 'combobox' || control === 'BUTTON') {
      await field.click()
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
