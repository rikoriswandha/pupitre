import { test, expect } from '@playwright/experimental-ct-react'
import { AxeBuilder } from '@axe-core/playwright'
import { FixtureStory } from './stories/catalog.story.js'
import type { JsonRenderSpec } from '@rikology/pupitre/catalog'

const spec: JsonRenderSpec = {
  root: 'permissions',
  elements: {
    permissions: {
      type: 'CheckboxList',
      props: {
        name: 'permissions',
        label: 'Permissions',
        required: true,
        helperText: 'Choose permissions for this role',
        error: 'Choose at least one permission',
        value: { $bindState: '/data/permissions' },
        options: ['viewAny', 'view', 'create', 'update'].map((ability) => ({
          value: `posts.${ability}`,
          label: ability,
        })),
      },
    },
  },
  state: { data: { permissions: [] } },
}

test('CheckboxList exposes exactly one independently named checkbox per permission', async ({
  mount,
  page,
}) => {
  const view = await mount(<FixtureStory name="CheckboxList" spec={spec} />)
  await expect(view.getByRole('checkbox')).toHaveCount(4)
  for (const name of ['viewAny', 'view', 'create', 'update']) {
    const checkbox = view.getByRole('checkbox', { name, exact: true })
    await expect(checkbox).toHaveCount(1)
    await expect(checkbox).toHaveAttribute('aria-required', 'true')
    await expect(checkbox).toHaveAttribute('aria-invalid', 'true')
    await expect(checkbox).toHaveAttribute(
      'aria-describedby',
      /permissions-helper permissions-error/
    )
    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toBeChecked()
    const size = await checkbox.boundingBox()
    expect(size?.width).toBeGreaterThanOrEqual(24)
    expect(size?.height).toBeGreaterThanOrEqual(24)
  }
  const results = await new AxeBuilder({ page: page as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('single checkbox keeps a visible keyboard focus ring and 24px target', async ({
  mount,
  page,
}) => {
  const view = await mount(<FixtureStory name="Checkbox" />)
  const checkbox = view.getByRole('checkbox').first()
  await expect(view.getByRole('checkbox')).toHaveCount(1)
  await checkbox.focus()
  await page.keyboard.press('Space')
  const size = await checkbox.boundingBox()
  expect(size?.width).toBeGreaterThanOrEqual(24)
  expect(size?.height).toBeGreaterThanOrEqual(24)
  await expect(checkbox).toHaveClass(/focus-visible:outline-2/)
})

test('Text falls back to the field name and links invalid required descriptions', async ({
  mount,
}) => {
  const view = await mount(
    <FixtureStory
      name="Text"
      spec={{
        root: 'title',
        elements: {
          title: {
            type: 'Text',
            props: { name: 'title', required: true, error: 'Required', helperText: 'Post title' },
          },
        },
      }}
    />
  )
  const input = view.getByRole('textbox', { name: 'title', exact: true })
  await expect(input).toHaveAttribute('aria-required', 'true')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAttribute('aria-describedby', /title-helper title-error/)
})
