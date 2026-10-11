import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import { pageProps, tableData as tableDataSchema } from '../../../catalog/wire.js'
import { table } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'

function deferLoadingPanel() {
  const posts = fixturePostResource.table((definition) =>
    definition.columns([table.text('title')]).deferLoading()
  )
  return fixturePanel.resources({ posts })
}

test.group('deferred list data', () => {
  test('omits deferred data from the initial visit and validates the partial data response', async ({
    assert,
  }) => {
    const fixture = await createTestApp({
      panels: { admin: async () => ({ default: deferLoadingPanel() }) },
    })
    try {
      const marker = `deferred-${Date.now()}`
      await Post.create({ title: marker, slug: marker, status: 'draft', tenantId: 1 })

      const initial = await new ApiClient(fixture.baseUrl)
        .get('/admin/posts')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .send()
      assert.equal(initial.status(), 200, initial.text())
      const initialProps = pageProps.parse(initial.body().props)
      assert.isUndefined(initialProps.data)

      const partial = await new ApiClient(fixture.baseUrl)
        .get('/admin/posts')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .header('X-Inertia-Partial-Component', 'pupitre')
        .header('X-Inertia-Partial-Data', 'data')
        .send()
      assert.equal(partial.status(), 200, partial.text())
      assert.deepEqual(
        Object.keys(partial.body().props).filter((key) => key !== 'errors'),
        ['data']
      )
      const data = tableDataSchema.parse(partial.body().props.data)
      assert.include(
        data.rows.map((row) => row.cells.title),
        marker
      )
    } finally {
      await closeTestApp(fixture)
    }
  })
})
