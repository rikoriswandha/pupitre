import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import { definePage, defineWidget, pages, stat } from '../../../index.js'
import { pageProps, widgetData } from '../../../catalog/wire.js'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixturePanel,
  fixturePostResource,
} from '../../helpers/app.js'

async function page(baseUrl: string, path: string) {
  return new ApiClient(baseUrl)
    .get(path)
    .header('Accept', 'text/html')
    .header('X-Inertia', 'true')
    .header('X-Inertia-Version', '1')
    .send()
}

async function poll(baseUrl: string, url: string, status = 'published') {
  return new ApiClient(baseUrl)
    .get(`${url}&filters%5Bstatus%5D=${status}`)
    .header('Accept', 'application/json')
    .send()
}

test.group('widget page context polling', () => {
  test('list header and footer URLs refresh their own definitions and enforce viewAny', async ({
    assert,
  }) => {
    allowPolicyAbilities()
    let revision = 1
    const header = defineWidget('shared-name')
      .stats(({ filters }) => [stat('Header', `${revision}:${String(filters.status ?? 'all')}`)])
      .poll('1s')
      .lazy(false)
    const footer = defineWidget('footer-only')
      .stats(() => [stat('Footer', String(revision))])
      .poll('1s')
      .lazy(false)
    const dashboard = defineWidget('shared-name').stats(() => [stat('Wrong', 'dashboard')])
    const resource = fixturePostResource.pages({
      list: pages.list().widgets([header]).footerWidgets([footer]),
    })
    const panel = fixturePanel.resources({ posts: resource }).widgets([dashboard])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const initial = await page(fixture.baseUrl, '/admin/posts')
      assert.equal(initial.status(), 200, initial.text())
      const props = pageProps.parse(initial.body().props)
      const descriptors = props.page.widgets ?? []
      assert.lengthOf(descriptors, 2)
      revision = 2
      for (const descriptor of descriptors) {
        assert.equal(descriptor.poll, 1000)
        const url = descriptor.dataUrl!
        const context = new URL(url, fixture.baseUrl).searchParams
        assert.equal(context.get('resource'), 'posts')
        assert.equal(context.get('widgetPage'), 'list')
        assert.isNull(context.get('page'))
        const response = await poll(fixture.baseUrl, `${url}&page=2`)
        assert.equal(response.status(), 200, response.text())
        const data = widgetData.parse(response.body())
        assert.equal(data.kind, 'stats')
        assert.include(
          JSON.stringify(data),
          descriptor.placement === 'header' ? '2:published' : '2'
        )
        assert.notInclude(JSON.stringify(data), 'dashboard')
      }
      denyPolicyAbility('viewAny')
      const denied = await poll(fixture.baseUrl, descriptors[0]!.dataUrl!)
      assert.equal(denied.status(), 403)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('custom-page URL refreshes its widget and rechecks page and widget visibility', async ({
    assert,
  }) => {
    let revision = 1
    let accessible = true
    let visible = true
    const widget = defineWidget('shared-name')
      .stats(({ filters }) => [stat('Report', `${revision}:${String(filters.status ?? 'all')}`)])
      .poll('1s')
      .lazy(false)
      .canView(() => visible)
    const custom = definePage('reports')
      .path('/reports')
      .widgets([widget])
      .canAccess(() => accessible)
    const dashboard = defineWidget('shared-name').stats(() => [stat('Wrong', 'dashboard')])
    const panel = fixturePanel.pages([custom]).widgets([dashboard])
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const initial = await page(fixture.baseUrl, '/admin/reports')
      assert.equal(initial.status(), 200, initial.text())
      const descriptor = pageProps.parse(initial.body().props).page.widgets![0]!
      const url = descriptor.dataUrl!
      assert.equal(new URL(url, fixture.baseUrl).searchParams.get('customPage'), 'reports')
      revision = 2
      const refreshed = await poll(fixture.baseUrl, url)
      assert.equal(refreshed.status(), 200, refreshed.text())
      assert.include(JSON.stringify(widgetData.parse(refreshed.body())), '2:published')
      assert.notInclude(JSON.stringify(refreshed.body()), 'dashboard')
      accessible = false
      const inaccessiblePage = await poll(fixture.baseUrl, url)
      assert.equal(inaccessiblePage.status(), 403)
      accessible = true
      visible = false
      const hiddenWidget = await poll(fixture.baseUrl, url)
      assert.equal(hiddenWidget.status(), 403)
      const missingPage = await poll(
        fixture.baseUrl,
        url.replace('customPage=reports', 'customPage=missing')
      )
      assert.equal(missingPage.status(), 404)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
