import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import { action, definePage, PupitreManager, schema } from '../../../index.js'
import { closeTestApp, createTestApp, fixturePanel } from '../../helpers/app.js'

const settings = { label: 'Initial' }
const settingsPage = definePage('settings')
  .path('/settings')
  .title('Settings')
  .form((s) => [s.text('label').required()])
  .fill(async () => ({ ...settings }))
  .save(async ({ data }) => Object.assign(settings, data))
  .actions([
    action('reset-label')
      .label('Reset label')
      .form([schema.text('value').required()])
      .handle(async ({ data }) => Object.assign(settings, { label: data?.value })),
  ])

const customPage = definePage('reports')
  .path('/reports')
  .title('Reports')
  .component('admin/Reports')
const deniedPage = definePage('restricted')
  .path('/restricted')
  .title('Restricted')
  .canAccess(() => false)

function appWithPages(pages: unknown[]) {
  return { admin: async () => ({ default: fixturePanel.pages(pages) }) }
}

test.group('custom pages', () => {
  test('renders page state, saves through VineJS, and runs header actions', async ({ assert }) => {
    settings.label = 'Initial'
    const fixture = await createTestApp({
      panels: appWithPages([settingsPage, customPage, deniedPage]),
    })
    try {
      const page = await new ApiClient(fixture.baseUrl)
        .get('/admin/settings')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .send()
      assert.equal(page.status(), 200, page.text())
      assert.equal(page.body().props.page.kind, 'page')
      assert.equal(page.body().props.page.state.data.label, 'Initial')
      assert.notInclude(JSON.stringify(page.body().props.pupitre.nav), 'Restricted')
      assert.equal(page.body().props.page.spec.elements.root.type, 'Form')
      assert.snapshot(page.body().props.page.spec).match()

      const invalid = await new ApiClient(fixture.baseUrl)
        .post('/admin/settings')
        .header('Accept', 'application/json')
        .json({ data: {} })
        .send()
      assert.equal(invalid.status(), 422)
      assert.property(invalid.body().errors, 'label')

      const saved = await new ApiClient(fixture.baseUrl)
        .post('/admin/settings')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .header('Referer', `${fixture.baseUrl}/admin/settings`)
        .json({ data: { label: 'Updated' } })
        .send()
      assert.equal(settings.label, 'Updated')
      assert.equal(saved.status(), 200, saved.text())
      assert.equal(saved.body().props.page.state.data.label, 'Updated')

      const actionForm = await new ApiClient(fixture.baseUrl)
        .get('/admin/settings/actions/reset-label')
        .header('Accept', 'application/json')
        .send()
      assert.equal(actionForm.status(), 200)
      assert.equal(actionForm.body().state.data.value, undefined)

      const actionResult = await new ApiClient(fixture.baseUrl)
        .post('/admin/settings/actions/reset-label')
        .header('Accept', 'application/json')
        .header('X-Pupitre-Action', '1')
        .json({ data: { value: 'Reset' } })
        .send()
      assert.equal(actionResult.status(), 200)
      assert.equal(settings.label, 'Reset')
      assert.isArray(actionResult.body().flash)

      const denied = await new ApiClient(fixture.baseUrl)
        .get('/admin/restricted')
        .header('Accept', 'application/json')
        .send()
      assert.equal(denied.status(), 403)

      const custom = await new ApiClient(fixture.baseUrl)
        .get('/admin/reports')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .send()
      assert.equal(custom.status(), 200)
      assert.equal(custom.body().component, 'admin/Reports')
      assert.equal(custom.body().props.page.kind, 'custom')
      assert.equal(custom.body().props.page.component, 'admin/Reports')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('rejects resource and page slug collisions during boot', async ({ assert }) => {
    const manager = new PupitreManager({
      container: { make: async () => ({}) },
    } as never)
    await assert.rejects(
      () => manager.boot([fixturePanel.pages([definePage('posts')])]),
      /slugs must be unique.*posts/
    )
  })
  test('rejects reserved built-in page slugs and paths during boot', async ({ assert }) => {
    for (const page of [
      definePage('dashboard').path('/reports'),
      definePage('reports').path('/search'),
      definePage('reports').path('/'),
    ]) {
      const manager = new PupitreManager({
        container: { make: async () => ({}) },
      } as never)
      await assert.rejects(
        () => manager.boot([fixturePanel.pages([page])]),
        /reserved for a built-in route/
      )
    }
  })
})
