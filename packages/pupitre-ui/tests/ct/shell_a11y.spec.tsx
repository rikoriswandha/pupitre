import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/experimental-ct-react'
import type { Locator, Page } from '@playwright/test'
import { ProfileSecurity } from '../../src/components/ProfileSecurity.js'
import { NotFound } from '../../src/components/NotFound.js'
import { AuthPasskeyA11yStory } from './stories/shell_a11y.story.js'
import {
  ShellA11yStory,
  DialogA11yStory,
  ToasterA11yStory,
  UserMenuA11yStory,
} from './stories/shell_a11y.story.js'
import { AuthShellStory } from './stories/auth_shell.story.js'
import { TenantSwitcherStory } from './stories/tenant_switcher.story.js'
import { NotificationTrayStory } from './stories/notification_tray.story.js'
import { GlobalSearchStory } from './stories/global_search.story.js'
import { ImportModalDialogStory } from './stories/import_modal.story.js'

async function axe(page: Page) {
  const results = await new AxeBuilder({ page: page as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Base UI's nonmodal menu focus guards are invisible redirect sentinels,
    // not controls. Tab focuses them only to move focus immediately onward.
    // Exclude this vendor implementation detail, never application content.
    .exclude('[data-base-ui-focus-guard]')
    .analyze()
  expect(results.violations).toEqual([])
}

async function trapped(page: Page, dialog: Locator) {
  const controls = dialog.locator(
    'button:not([disabled]), input:not([disabled]), a[href], select:not([disabled])'
  )
  await controls.last().focus()
  await page.keyboard.press('Tab')
  await expect(controls.first()).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(controls.last()).toBeFocused()
}

test('desktop shell has named navigation, a single main and accessible collapsed group controls', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await mount(<ShellA11yStory sidebar="collapsed" />)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('main').getByRole('banner')).toHaveCount(0)
  const landmarks = await new AxeBuilder({ page: page as never })
    .withRules([
      'landmark-banner-is-top-level',
      'landmark-complementary-is-top-level',
      'landmark-contentinfo-is-top-level',
      'landmark-main-is-top-level',
      'landmark-no-duplicate-banner',
      'landmark-no-duplicate-contentinfo',
      'landmark-no-duplicate-main',
      'landmark-one-main',
      'landmark-unique',
    ])
    .analyze()
  expect(landmarks.violations).toEqual([])
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(1)
  const group = page.getByRole('button', { name: 'Content', exact: true })
  await expect(group).toHaveAccessibleName('Content')
  await group.click()
  await expect(group).toHaveAttribute('aria-expanded', 'false')
  await axe(page)
})

test('closed mobile navigation is not tabbable; open navigation traps focus and Escape restores it', async ({
  mount,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(<ShellA11yStory />)
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0)
  const trigger = page.getByRole('button', { name: 'Open navigation' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Navigation' })
  await expect(dialog).toBeVisible()
  await trapped(page, dialog)
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await axe(page)
})

test('top navigation submenu supports keyboard opening and Escape focus return', async ({
  mount,
  page,
}) => {
  await mount(<ShellA11yStory sidebar="top-nav" />)
  const summary = page.locator('summary').filter({ hasText: 'Content' })
  await summary.focus()
  await page.keyboard.press('Enter')
  const link = page.getByRole('link', { name: 'Posts', exact: true })
  await expect(link).toBeVisible()
  await link.focus()
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(link).toBeHidden()
  await expect(summary).toBeFocused()
})

test('auth shell exposes its main landmark and named authentication navigation', async ({
  mount,
  page,
}) => {
  // Hosts may paint their own canvas; the auth surface must not blend with it.
  await page.addStyleTag({ content: 'body { background: #6b7280; }' })
  await mount(<AuthShellStory />)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Authentication' })).toBeVisible()
  await axe(page)
})

for (const kind of ['modal', 'confirm', 'slide-over', 'untitled'] as const) {
  test(`${kind} dialog is named, traps keyboard focus and restores opener on Escape`, async ({
    mount,
    page,
  }) => {
    await mount(
      <DialogA11yStory
        kind={kind === 'confirm' ? 'confirm' : 'modal'}
        slideOver={kind === 'slide-over'}
        untitled={kind === 'untitled'}
      />
    )
    const opener = page.getByRole('button', { name: 'Open dialog' })
    await opener.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', {
      name: kind === 'confirm' ? 'Delete post?' : kind === 'untitled' ? 'Dialog' : 'Edit post',
      exact: true,
    })
    await expect(dialog).toBeVisible()
    await trapped(page, dialog)
    await axe(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })
}

test('import dialog upload and mapping states are accessible and retain focus containment', async ({
  mount,
  page,
}) => {
  await page.route('**/admin/posts/import/preview?*', (route) =>
    route.fulfill({
      json: {
        headers: ['title'],
        preview: [{ title: 'A post' }],
        fields: [{ name: 'title', label: 'Title', required: true }],
      },
    })
  )
  await page.route('**/admin/posts/import?*', (route) =>
    route.fulfill({
      json: {
        total: 1,
        created: 1,
        updated: 0,
        failed: 0,
      },
    })
  )
  await mount(<ImportModalDialogStory />)
  const opener = page.getByRole('button', { name: 'Open import' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Import CSV' })
  await trapped(page, dialog)
  await axe(page)
  await page.getByLabel('CSV file').setInputFiles({
    name: 'posts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('title\nA post\n'),
  })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('combobox', { name: 'Map title' })).toBeVisible()
  await trapped(page, dialog)
  await axe(page)
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click()
  await expect(page.getByText('1 created, 0 updated, 0 failed.')).toBeVisible()
  await trapped(page, dialog)
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

for (const menu of ['tenant', 'user'] as const) {
  test(`${menu} menu open state passes axe and Escape returns keyboard focus`, async ({
    mount,
    page,
  }) => {
    await mount(menu === 'tenant' ? <TenantSwitcherStory /> : <UserMenuA11yStory />)
    const trigger = page.getByRole('button', {
      name: menu === 'tenant' ? 'Switch tenant' : 'Open user menu',
    })
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menu')).toBeVisible()
    await axe(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(trigger).toBeFocused()
  })
}

test('notifications popup supports keyboard dismissal and restores the bell focus', async ({
  mount,
  page,
}) => {
  await mount(<NotificationTrayStory />)
  const bell = page.getByRole('button', { name: 'Notifications', exact: true })
  await bell.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Post published')).toBeVisible()
  await axe(page)
  await page.getByRole('button', { name: 'Mark all read' }).focus()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Post published')).toBeHidden()
  await expect(bell).toBeFocused()
})

test('global search empty and populated dialog states trap focus and Escape returns to trigger', async ({
  mount,
  page,
}) => {
  await mount(<GlobalSearchStory />)
  const trigger = page.getByRole('button', { name: 'Global search' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Global search' })
  const input = page.getByRole('combobox', { name: 'Search resources' })
  await expect(input).toBeFocused()
  await trapped(page, dialog)
  await axe(page)
  await input.fill('Field')
  await expect(page.getByRole('option', { name: /Field Notes/ })).toBeVisible()
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeVisible()
  await expect(input).toBeFocused()
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('toast roles and unique dismiss names allow keyboard dismissal of the correct notification', async ({
  mount,
  page,
}) => {
  await mount(<ToasterA11yStory />)
  await expect(page.getByRole('alert')).toContainText('Upload failed')
  await expect(page.getByRole('status').filter({ hasText: 'Post saved' })).toBeVisible()
  await axe(page)
  const dismiss = page.getByRole('button', {
    name: 'Dismiss notification: Upload failed',
    exact: true,
  })
  await dismiss.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Upload failed')).toBeHidden()
  await expect(page.getByText('Post saved')).toBeVisible()
})

test('security controls remain uniquely labelled across instances and MFA enrollment passes axe', async ({
  mount,
  page,
}) => {
  await page.route('**/admin/profile/passkeys', (route) =>
    route.fulfill({ json: { passkeys: [{ id: 1, name: 'Laptop' }] } })
  )
  await page.route('**/admin/profile/mfa/setup', (route) =>
    route.fulfill({
      json: {
        secret: 'ABC123',
        qrCode:
          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="176" height="176"/%3E',
      },
    })
  )
  await mount(
    <main>
      <h1>Profile</h1>
      <ProfileSecurity basePath="/admin" mfaEnabled={false} passkeysEnabled />
      <ProfileSecurity basePath="/admin" mfaEnabled passkeysEnabled />
    </main>
  )
  const names = page.getByRole('textbox', { name: 'Passkey name', exact: true })
  await expect(names).toHaveCount(2)
  const ids = await names.evaluateAll((inputs) => inputs.map((input) => input.id))
  expect(new Set(ids).size).toBe(2)
  await expect(page.getByText('Laptop', { exact: true })).toHaveCount(2)
  await axe(page)
  await page.getByRole('button', { name: 'Set up MFA' }).click()
  await expect(
    page.getByRole('img', { name: 'Scan this QR code with your authenticator app' })
  ).toBeVisible()
  await axe(page)
})

test('passkey auth shell is accessible before browser authentication', async ({ mount, page }) => {
  await mount(<AuthPasskeyA11yStory />)
  await axe(page)
})

test('not found page has a main landmark, heading and accessible return link', async ({
  mount,
  page,
}) => {
  await mount(<NotFound title="Page not found" message="This page is no longer available." />)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible()
  await axe(page)
})
