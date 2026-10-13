import { expect, test } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import { KanbanStory } from './stories/kanban.story.js'

test('keyboard dragging persists a card between columns and passes axe in both themes', async ({
  mount,
  page,
}) => {
  const board = await mount(<KanbanStory />)
  const handle = board.getByRole('button', { name: 'Move First card' })
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await expect(board.locator('article').first()).toHaveAttribute('data-over', 'true')
  // KeyboardSensor installs its document listener on the next task after activation.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await page.keyboard.press('ArrowRight')
  await expect(board.getByRole('region', { name: 'Published', exact: true })).toHaveAttribute(
    'data-over',
    'true'
  )
  await expect(page.getByRole('status')).toContainText('First card is over Published at position 1')
  await page.keyboard.press('Space')
  await expect(
    board.getByRole('region', { name: 'Published', exact: true }).getByText('First card')
  ).toBeVisible()
  await expect(
    board
      .getByRole('region', { name: 'Published', exact: true })
      .getByRole('button', { name: 'Move First card' })
  ).toBeFocused()
  await expect(page.getByRole('status')).toContainText(
    'First card dropped in Published at position 1'
  )
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished))
    )
    const analysis = await new AxeBuilder({
      page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'],
    })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(analysis.violations).toEqual([])
  }
})
for (const failureStatus of [403, 422] as const) {
  test(`HTTP ${failureStatus} move restores source and announces failure`, async ({
    mount,
    page,
  }) => {
    const board = await mount(<KanbanStory fail failureStatus={failureStatus} />)
    await board.getByRole('button', { name: 'Move First card' }).focus()
    await page.keyboard.press('Space')
    await expect(board.getByRole('button', { name: 'Move First card' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(board.locator('article').first()).toHaveAttribute('data-over', 'true')
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    )
    await page.keyboard.press('ArrowRight')
    await expect(board.getByRole('region', { name: 'Published', exact: true })).toHaveAttribute(
      'data-over',
      'true'
    )
    await page.keyboard.press('Space')
    await expect(board.getByRole('alert')).toContainText(
      'Unable to move card. Changes were restored.'
    )
    await expect(
      board.getByRole('region', { name: 'Draft', exact: true }).getByText('First card')
    ).toBeVisible()
  })
}

test('a committed move survives a failed reload and retains focus', async ({ mount, page }) => {
  const board = await mount(<KanbanStory reloadFailure />)
  await board.getByRole('button', { name: 'Move First card' }).focus()
  await page.keyboard.press('Space')
  await expect(board.getByRole('button', { name: 'Move First card' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await page.keyboard.press('ArrowRight')
  await expect(board.getByRole('region', { name: 'Published', exact: true })).toHaveAttribute(
    'data-over',
    'true'
  )
  await page.keyboard.press('Space')
  await expect(board.getByRole('alert')).toContainText('Unable to load board')
  await expect(
    board
      .getByRole('region', { name: 'Published', exact: true })
      .getByRole('button', { name: 'Move First card' })
  ).toBeFocused()
  await expect(
    board.getByRole('region', { name: 'Draft', exact: true }).getByText('First card')
  ).toHaveCount(0)
})
