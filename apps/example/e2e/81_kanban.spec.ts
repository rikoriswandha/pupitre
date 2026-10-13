import { pupitreTest, expect } from '@rikology/pupitre-ui/testing'

pupitreTest(
  'orders board moves a card and preserves the status after reload',
  async ({ admin, page }) => {
    await admin.login()
    await admin.gotoResource('orders-board')
    const createUrl = await page
      .getByRole('link', { name: 'Create in Paid', exact: true })
      .getAttribute('href')
    const prefill = await page.request.get(createUrl!, { headers: { 'X-Inertia': 'true' } })
    const createPage = (await prefill.json()) as {
      props: { page: { state: { data: { status: string } } } }
    }
    expect(createPage.props.page.state.data.status).toBe('paid')
    const source = page.getByRole('region', { name: 'Pending', exact: true })
    // Orders have a `total` attribute; column counts must not be swallowed by model mapping.
    await expect(source.locator('article').first()).toBeVisible()
    const pendingCards = await source.locator('article').count()
    await expect(source.locator('h2 > span').last()).toHaveText(String(pendingCards))
    const card = source.locator('article').first()
    const title = await card.locator('a').innerText()
    await card.getByRole('button', { name: `Move ${title}`, exact: true }).focus()
    await page.keyboard.press('Space')
    await expect(card.getByRole('button', { name: `Move ${title}`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(card).toHaveAttribute('data-over', 'true')
    await page.evaluate('new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))')
    await page.keyboard.press('ArrowRight')
    await expect(
      page
        .locator(
          'section[aria-label="Paid"][data-over="true"], section[aria-label="Paid"] article[data-over="true"]'
        )
        .first()
    ).toBeVisible()
    await page.keyboard.press('Space')
    const target = page.getByRole('region', { name: 'Paid', exact: true })
    await expect(target.getByRole('link', { name: title, exact: true })).toBeVisible()
    await page.reload()
    await expect(target.getByRole('link', { name: title, exact: true })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('kanban-board')).toBeVisible()
    expect(
      await page.getByTestId('kanban-board').evaluate((element) => {
        const board = element as unknown as { scrollWidth: number; clientWidth: number }
        return board.scrollWidth > board.clientWidth
      })
    ).toBe(true)
  }
)
