import { test as base, expect, type Locator, type Page } from '@playwright/test'

/** Where the panel under test lives and how to sign in. */
export type PupitreOptions = {
  /** Panel path, e.g. `/admin` (login lives at `<panelPath>/login`). */
  panelPath: string
  /** Resource base path; differs from `panelPath` in tenancy mode `url` (e.g. `/admin/acme`). */
  basePath?: string
  /** Where `login()` redirects and waits for; defaults to `basePath`. */
  landingPath?: string
  email?: string
  password?: string
}

export type PupitreFixtures = { pupitre: PupitreOptions; admin: AdminPage }

export class AdminPage {
  readonly panelPath: string
  readonly basePath: string
  readonly landingPath: string
  constructor(
    readonly page: Page,
    readonly options: PupitreOptions = { panelPath: '/admin' }
  ) {
    this.panelPath = trimSlash(options.panelPath)
    this.basePath = trimSlash(options.basePath ?? options.panelPath)
    this.landingPath = options.landingPath ?? this.basePath
  }

  url(path: string) {
    return `${this.basePath}${path.startsWith('/') ? path : `/${path}`}`
  }

  async login(
    email = this.options.email ?? '',
    password = this.options.password ?? '',
    landingPath = this.landingPath
  ) {
    await this.page.goto(`${this.panelPath}/login?redirect=${encodeURIComponent(landingPath)}`)
    await this.page.getByLabel('Email').fill(email)
    await this.page.getByLabel('Password').fill(password)
    await this.page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await this.page.waitForURL(`**${landingPath}`)
  }

  async gotoResource(slug: string, path = '') {
    await this.page.goto(this.url(`/${slug}${path}`))
  }

  async fillField(label: string, value: string | number) {
    const field = await this.field(label)
    const tag = await field.evaluate((element) => (element as { tagName: string }).tagName)
    if (tag === 'SELECT') return field.selectOption(String(value))
    if ((await field.getAttribute('data-options-search')) !== null) {
      await field.click()
      await field.fill(String(value))
      await this.page.getByRole('option', { name: String(value), exact: true }).click()
      return
    }
    const role = await field.getAttribute('role')
    if (role === 'combobox' || tag === 'BUTTON') return this.selectOption(label, String(value))
    await field.fill(String(value))
  }

  async field(label: string) {
    const dialogField = this.page.getByRole('dialog').getByLabel(label, { exact: false }).first()
    if ((await dialogField.count()) > 0) return dialogField
    return this.page.locator('form').getByLabel(label, { exact: false }).first()
  }

  async selectOption(label: string, value: string) {
    const field = await this.field(label)
    if (
      (await field.evaluate((element) => (element as { tagName: string }).tagName)) === 'SELECT'
    ) {
      await field.selectOption(value)
      return
    }
    await field.click()
    const search = this.page.getByRole('textbox', { name: 'Search options' }).last()
    if (await search.isVisible().catch(() => false)) await search.fill(value)
    await this.page.getByRole('option', { name: value, exact: true }).click()
  }

  async openAction(name: string, row?: Locator) {
    await (row ?? this.page).getByRole('button', { name, exact: true }).click()
  }

  async submitModal(name = 'Submit') {
    await this.page.getByRole('dialog').getByRole('button', { name, exact: true }).click()
  }

  async expectToast(message: string) {
    await expect(this.page.getByText(message, { exact: false }).last()).toBeVisible()
  }

  row(name: string) {
    return this.page.getByRole('row').filter({ hasText: name })
  }

  table() {
    return this.page.getByRole('table')
  }
}

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/$/, '') : path
}

/**
 * Playwright fixture. Configure the panel once in `playwright.config.ts`:
 * `use: { pupitre: { panelPath: '/admin', email: '…', password: '…' } }`.
 */
export const pupitreTest = base.extend<PupitreFixtures>({
  pupitre: [{ panelPath: '/admin' }, { option: true }],
  admin: async ({ page, pupitre }, use) => {
    // Playwright names the fixture continuation callback `use`; it is not a React hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(new AdminPage(page, pupitre))
  },
})

export { expect }
