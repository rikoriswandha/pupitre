import { test, expect } from '@playwright/experimental-ct-react'
import { formatInputMask, unmaskInput } from '../../src/components/Text.js'
import { ActionStory, FixtureStory } from './stories/catalog.story.js'

test('Text mask formats the input while its binding value remains unmasked', async ({ mount }) => {
  const view = await mount(<FixtureStory name="Text" />)
  const input = view.getByRole('textbox', { name: 'Title' })
  await expect(input).toHaveValue('01/01/2024')
  await input.fill('12312026')
  await expect(input).toHaveValue('12/31/2026')
  expect(unmaskInput('12/31/2026', '99/99/9999')).toBe('12312026')
  expect(formatInputMask('12312026', '99/99/9999')).toBe('12/31/2026')
})
test('phone mask typing consumes leading literal positions without storing them', async ({
  mount,
}) => {
  const view = await mount(
    <FixtureStory
      name="masked-phone"
      spec={
        {
          root: 'phone',
          state: { data: { phone: '' } },
          elements: {
            phone: {
              type: 'Text',
              props: { name: 'phone', label: 'Phone', mask: '+1 (999) 999-9999', value: '' },
            },
          },
        } as never
      }
    />
  )
  const input = view.getByRole('textbox', { name: 'Phone' })
  await input.fill('+1 (415) 555-2671')
  await expect(input).toHaveValue('+1 (415) 555-2671')
  expect(unmaskInput('+1 (415) 555-2671', '+1 (999) 999-9999')).toBe('4155552671')
})

test('Text renders hint tooltip and prefix/suffix actions', async ({ mount }) => {
  const view = await mount(<FixtureStory name="Text" />)
  await expect(view.locator('[title="Date format: MM/DD/YYYY."]')).toBeVisible()
  await expect(view.getByRole('button', { name: 'Hint action' })).toBeVisible()
  await expect(view.getByRole('button', { name: 'Prefix action' })).toBeVisible()
  await expect(view.getByRole('button', { name: 'Suffix action' })).toBeVisible()
})

test('Textarea autosize grows beyond its configured row count', async ({ mount }) => {
  const view = await mount(<FixtureStory name="Textarea" />)
  const textarea = view.getByRole('textbox')
  const initialHeight = await textarea.evaluate((element) =>
    Number.parseFloat(element.style.height)
  )
  await textarea.fill('one\ntwo\nthree\nfour\nfive')
  await expect
    .poll(() => textarea.evaluate((element) => Number.parseFloat(element.style.height)))
    .toBeGreaterThan(initialHeight)
})

test('masked Text submits raw digits in bound action data', async ({ mount, page }) => {
  const view = await mount(<ActionStory />)
  const input = page.getByRole('textbox', { name: 'Title' })
  await expect(input).toBeVisible()
  await input.fill('12312026')
  await expect(input).toHaveValue('12/31/2026')
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect
    .poll(async () => {
      const calls = JSON.parse((await view.getByTestId('router-calls').textContent()) ?? '[]')
      const post = calls.find((call: { method: string }) => call.method === 'POST')
      return post?.body?.data?.title
    })
    .toBe('12312026')
})
test('Slider fixture exposes bounded accessible range controls', async ({ mount }) => {
  const view = await mount(<FixtureStory name="Slider" />)
  const slider = view.getByRole('slider', { name: 'Priority' })
  await expect(slider).toHaveAttribute('min', '0')
  await expect(slider).toHaveAttribute('max', '100')
  await expect(slider).toHaveAttribute('step', '5')
})
