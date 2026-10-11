import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/experimental-ct-react'

const hostCss = readFileSync(
  new URL('../../../../apps/example/inertia/css/app.css', import.meta.url),
  'utf8'
)
const pupitreCss = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8')

test('example public-site tokens do not shadow Pupitre surfaces or keyboard focus', async ({
  page,
}) => {
  const declarations = [...hostCss.matchAll(/(?:^|[;{])\s*(--[\w-]+)\s*:/g)].map(
    (match) => match[1]
  )
  const reserved =
    /^--(?:background|foreground|card(?:-.+)?|popover(?:-.+)?|primary(?:-.+)?|secondary(?:-.+)?|muted(?:-.+)?|accent(?:-.+)?|destructive(?:-.+)?|border|input|ring|radius|sidebar(?:-.+)?)$/
  expect(declarations.filter((name) => reserved.test(name))).toEqual([])
  // Exercise the same unlayered order as the example without Tailwind imports.
  await page.addStyleTag({
    content: pupitreCss.replace(/^@import[^;]+;/gm, '').replace(/@theme inline\s*\{[^}]*\}/g, ''),
  })
  const before = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return { card: style.getPropertyValue('--card'), ring: style.getPropertyValue('--ring') }
  })
  await page.addStyleTag({ content: hostCss.replace(/^@import[^;]+;/gm, '') })
  const after = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    return { card: style.getPropertyValue('--card'), ring: style.getPropertyValue('--ring') }
  })
  expect(after).toEqual(before)
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
  })
  const dark = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--card')
  )
  expect(dark).not.toBe(before.card)
  const publicCard = await page.evaluate(() => {
    const element = document.createElement('div')
    element.className = 'panel'
    document.body.append(element)
    return getComputedStyle(element).backgroundColor
  })
  expect(publicCard).toBe('rgb(255, 255, 255)')
})
