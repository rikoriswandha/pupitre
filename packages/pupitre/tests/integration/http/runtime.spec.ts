import { test } from '@japa/runner'
import { ApiClient } from '@japa/api-client'
import { pageProps } from '../../../catalog/wire.js'
import { closeTestApp, createTestApp, Post } from '../../helpers/app.js'

test.group('Pupitre HTTP runtime', () => {
  test('boots the fixture host and renders the resource list over HTTP', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      const marker = `list-${Date.now()}`
      await Post.create({ title: `A ${marker}`, slug: `${marker}-a`, status: 'draft', tenantId: 1 })
      await Post.create({ title: `B ${marker}`, slug: `${marker}-b`, status: 'draft', tenantId: 1 })
      await Post.create({
        title: `C ${marker}`,
        slug: `${marker}-c`,
        status: 'published',
        tenantId: 1,
      })
      const response = await new ApiClient(fixture.baseUrl)
        .get('/admin/posts')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .send()
      assert.equal(response.status(), 200, response.text())
      assert.equal(response.body().component, 'pupitre')
      assert.isTrue(pageProps.safeParse(response.body().props).success)
      assert.isArray(response.body().props.pupitre.nav)
      assert.equal(response.body().props.page.kind, 'list')
      assert.isArray(response.body().props.data.rows)
      const query = await new ApiClient(fixture.baseUrl)
        .get(
          `/admin/posts?sort=title&q=${encodeURIComponent(marker)}&filters%5Bstatus%5D=draft&tab=draft&page=2&perPage=1`
        )
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .send()
      const queriedData = query.body().props.data
      assert.equal(query.status(), 200, query.text())
      assert.deepEqual(
        queriedData.rows.map((row: { cells: { title: string } }) => row.cells.title),
        [`B ${marker}`]
      )
      assert.deepEqual(queriedData.meta, {
        total: 2,
        perPage: 1,
        currentPage: 2,
        lastPage: 2,
        from: 2,
        to: 2,
      })
      assert.deepEqual(queriedData.query, {
        sort: 'title',
        q: marker,
        filters: { status: 'draft' },
        tab: 'draft',
        perPage: 1,
        page: 2,
      })
      const partial = await new ApiClient(fixture.baseUrl)
        .get('/admin/posts')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .header('X-Inertia-Partial-Component', 'pupitre')
        .header('X-Inertia-Partial-Data', 'data')
        .send()
      assert.equal(partial.status(), 200)
      assert.deepEqual(
        Object.keys(partial.body().props).filter((key) => key !== 'errors'),
        ['data']
      )
      const invalidSort = await new ApiClient(fixture.baseUrl)
        .get('/admin/posts?sort=unknown')
        .header('Accept', 'text/html')
        .header('X-Inertia', 'true')
        .header('X-Inertia-Version', '1')
        .send()
      assert.equal(invalidSort.status(), 400)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
