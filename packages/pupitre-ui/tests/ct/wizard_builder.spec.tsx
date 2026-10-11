import { expect, test } from '@playwright/experimental-ct-react'
import { BuilderStory, Wizard422Story, WizardStory } from './stories/wizard_builder.story.js'

test('Builder adds, reorders, removes and clones blocks without moving their typed data', async ({
  mount,
}) => {
  const view = await mount(<BuilderStory />)
  await view.getByRole('button', { name: 'Add Heading' }).click()
  await view.getByRole('button', { name: 'Add Heading' }).click()
  const inputs = view.locator('[data-builder="content"] input')
  await expect(inputs).toHaveCount(3)
  await inputs.nth(0).fill('Existing')
  await inputs.nth(1).fill('first typed')
  await inputs.nth(2).fill('second typed')
  await view.getByRole('button', { name: 'Move block 3 up' }).click()
  await expect(inputs.nth(1)).toHaveValue('second typed')
  await view.getByRole('button', { name: 'Clone block 2' }).click()
  await view.getByRole('button', { name: 'Remove block 1' }).click()
  await expect(inputs).toHaveCount(3)
  await expect(inputs.nth(0)).toHaveValue('second typed')
  await expect(inputs.nth(1)).toHaveValue('second typed')
  await expect(inputs.nth(2)).toHaveValue('first typed')
})

test('Wizard moves between steps and keeps inactive step mounted', async ({ mount }) => {
  const view = await mount(<WizardStory />)
  const accountStep = view.locator('[data-wizard-step="account"]')
  const profileStep = view.locator('[data-wizard-step="profile"]')
  await expect(accountStep).toBeVisible()
  await expect(profileStep).toBeHidden()
  await view.getByRole('button', { name: 'Next' }).click()
  await expect(profileStep).toBeVisible()
  await expect(view.getByRole('button', { name: /Profile/ })).toBeFocused()
  await expect(view.getByRole('button', { name: 'Next' })).toBeDisabled()
  await expect(accountStep).toBeHidden()
  await view.getByRole('button', { name: 'Back' }).click()
  await expect(accountStep).toBeVisible()
})

test('Wizard preserves the selected step despite errors until the submit attempt jumps once', async ({
  mount,
}) => {
  const view = await mount(<Wizard422Story />)
  await expect(view.locator('[data-wizard-step="account"]')).toBeHidden()
  await expect(view.locator('[data-wizard-step="profile"]')).toBeVisible()
  await expect(view.getByText('Profile information')).toBeVisible()
  await expect(view.getByRole('button', { name: /Profile/ }).locator('svg')).toBeVisible()
  await view.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(view.locator('[data-wizard-step="account"]')).toBeVisible()
  await expect(view.locator('[data-wizard-step="profile"]')).toBeHidden()
  await view.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(view.locator('[data-wizard-step="profile"]')).toBeVisible()
  await view.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(view.locator('[data-wizard-step="account"]')).toBeVisible()
})
