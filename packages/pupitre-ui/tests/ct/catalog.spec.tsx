import { test, expect } from '@playwright/experimental-ct-react'
import AxeBuilder from '@axe-core/playwright'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { catalogFixtures } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, setRouter } from '@rikology/pupitre-react'
import { components } from '../../src/components.js'

const registry = defineRegistry(components)
const shellProps: PupitrePageProps['pupitre'] = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Test Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
}

function fixturePage(name: string): PupitrePageProps['page'] {
  const fixture = catalogFixtures[name as keyof typeof catalogFixtures]
  return {
    key: `fixture:${name}`,
    kind: 'custom',
    title: name,
    breadcrumbs: [],
    spec: fixture,
    state: fixture.state ?? {},
    actions: { header: [] },
    catalogVersion: '0.1',
  }
}

function RuntimeFixture({ name }: { name: string }) {
  const page = fixturePage(name)
  return (
    <PupitreRenderer
      page={page}
      pupitre={shellProps}
      registry={registry}
      runAction={async () => {}}
      submitForm={() => {}}
      upload={async () => ({})}
      toast={() => {}}
    />
  )
}

for (const name of Object.keys(catalogFixtures)) {
  test(`catalog fixture ${name} renders accessibly`, async ({ mount, page }) => {
    const view = await mount(<RuntimeFixture name={name} />)
    await expect(view).toBeVisible()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([])
    await view.unmount()
  })
}
test('DataTable header sorting reloads with the selected sort', async ({ mount }) => {
  const calls: Array<{ only?: string[]; data?: Record<string, unknown> }> = []
  const restore = setRouter({
    reload: (options: { only?: string[]; data?: Record<string, unknown> }) => calls.push(options),
  } as never)
  try {
    const view = await mount(<RuntimeFixture name="DataTable" />)
    await view.getByRole('button', { name: 'Title' }).click()
    await expect.poll(() => calls.length).toBeGreaterThan(0)
    expect(calls[0]?.only).toEqual(['data'])
    expect(calls[0]?.data?.['sort']).toBe('title')
    await view.unmount()
  } finally {
    restore()
  }
})
