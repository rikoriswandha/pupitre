import { test } from '@japa/runner'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixtureCategoryResource,
  fixturePanel,
  fixturePostResource,
  Post,
  User,
} from '../../helpers/app.js'
import { table } from '../../../index.js'

function csrf(cookie: string) {
  const value = cookie
    .split('; ')
    .find((part) => part.startsWith('XSRF-TOKEN='))
    ?.slice(11)
  return value ? decodeURIComponent(value) : ''
}

function interactionResource() {
  return fixturePostResource.table((t) =>
    t
      .columns([
        table.toggle('isFeatured'),
        table.select('status').options({ draft: 'Draft', published: 'Published' }),
        table.textInput('title').validation({ required: true, maxLength: 10 }),
        table.text('slug'),
      ])
      .reorderable('viewsCount')
  )
}

async function setup() {
  const panel = fixturePanel.resources({
    posts: interactionResource(),
    categories: fixtureCategoryResource,
  })
  const fixture = await createTestApp({
    csrf: true,
    panels: { admin: async () => ({ default: panel }) },
  })
  const user = await User.create({
    name: 'Interaction admin',
    email: `interact-${Date.now()}@example.test`,
  })
  const cookie = await fixture.loginAs(user)
  return { fixture, cookie }
}

async function request(
  baseUrl: string,
  cookie: string,
  url: string,
  method: 'PATCH' | 'POST',
  body: unknown
) {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      'Cookie': cookie,
      'X-XSRF-TOKEN': csrf(cookie),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test.group('table inline editing and reorder HTTP endpoints', () => {
  test('patches an editable column, validates input, and hides unknown/non-editable columns', async ({
    assert,
  }) => {
    const { fixture, cookie } = await setup()
    try {
      const record = await Post.create({
        title: 'Small',
        slug: 'small',
        status: 'draft',
        tenantId: 1,
      })
      const success = await request(
        fixture.baseUrl,
        cookie,
        `/admin/posts/${record.id}/column/isFeatured`,
        'PATCH',
        { value: true }
      )
      assert.equal(success.status, 204)
      await record.refresh()
      assert.isTrue(Boolean(record.isFeatured))
      const listing = await fetch(`${fixture.baseUrl}/admin/posts`, {
        headers: {
          'Cookie': cookie,
          'Accept': 'text/html',
          'X-Inertia': 'true',
          'X-Inertia-Version': '1',
        },
      })
      const listingBody = (await listing.json()) as {
        props: { data: { rows: { key: string | number; cells: Record<string, unknown> }[] } }
      }
      const listedRecord = listingBody.props.data.rows.find(
        (row) => String(row.key) === String(record.id)
      )
      assert.deepEqual(listedRecord?.cells.isFeatured, { value: true, display: 'On' })

      const invalid = await request(
        fixture.baseUrl,
        cookie,
        `/admin/posts/${record.id}/column/title`,
        'PATCH',
        { value: 'This title is much too long' }
      )
      assert.equal(invalid.status, 422)
      const invalidBody = (await invalid.json()) as { errors: Record<string, string[]> }
      assert.isArray(invalidBody.errors.value)

      const unknown = await request(
        fixture.baseUrl,
        cookie,
        `/admin/posts/${record.id}/column/missing`,
        'PATCH',
        { value: true }
      )
      assert.equal(unknown.status, 404)
      const nonEditable = await request(
        fixture.baseUrl,
        cookie,
        `/admin/posts/${record.id}/column/slug`,
        'PATCH',
        { value: 'changed' }
      )
      assert.equal(nonEditable.status, 404)
      const malformed = await request(
        fixture.baseUrl,
        cookie,
        `/admin/posts/${record.id}/column/isFeatured`,
        'PATCH',
        { value: false, extra: true }
      )
      assert.equal(malformed.status, 400)
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('enforces update authorization and hides cross-scope records', async ({ assert }) => {
    const { fixture, cookie } = await setup()
    try {
      const visible = await Post.create({
        title: 'Visible',
        slug: 'visible',
        status: 'draft',
        tenantId: 1,
      })
      const foreign = await Post.create({
        title: 'Foreign',
        slug: 'foreign',
        status: 'draft',
        tenantId: 2,
      })
      denyPolicyAbility('update')
      const forbidden = await request(
        fixture.baseUrl,
        cookie,
        `/admin/posts/${visible.id}/column/isFeatured`,
        'PATCH',
        { value: true }
      )
      assert.equal(forbidden.status, 403)
      allowPolicyAbilities()
      const crossScope = await request(
        fixture.baseUrl,
        cookie,
        `/admin/posts/${foreign.id}/column/isFeatured`,
        'PATCH',
        { value: true }
      )
      assert.equal(crossScope.status, 404)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('authorizes reorder through reorder/update and persists scoped order', async ({
    assert,
  }) => {
    const { fixture, cookie } = await setup()
    try {
      const first = await Post.create({
        title: 'First',
        slug: 'first',
        status: 'draft',
        tenantId: 1,
        viewsCount: 8,
      })
      const second = await Post.create({
        title: 'Second',
        slug: 'second',
        status: 'draft',
        tenantId: 1,
        viewsCount: 9,
      })
      const response = await request(fixture.baseUrl, cookie, '/admin/posts/reorder', 'POST', {
        ids: [second.id, first.id],
      })
      assert.equal(response.status, 204, await response.clone().text())
      await first.refresh()
      await second.refresh()
      assert.equal(second.viewsCount, 0)
      assert.equal(first.viewsCount, 1)
      const foreign = await Post.create({
        title: 'Foreign order',
        slug: 'foreign-order',
        status: 'draft',
        tenantId: 2,
      })
      const crossScope = await request(fixture.baseUrl, cookie, '/admin/posts/reorder', 'POST', {
        ids: [first.id, foreign.id],
      })
      assert.equal(crossScope.status, 404)

      denyPolicyAbility('update')
      const forbidden = await request(fixture.baseUrl, cookie, '/admin/posts/reorder', 'POST', {
        ids: [first.id, second.id],
      })
      assert.equal(forbidden.status, 403)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
  test('reorders a page-two window without resetting earlier global positions', async ({
    assert,
  }) => {
    const { fixture, cookie } = await setup()
    try {
      const records = await Promise.all(
        ['One', 'Two', 'Three', 'Four'].map((title, index) =>
          Post.create({
            title,
            slug: title.toLowerCase(),
            status: 'draft',
            tenantId: 1,
            viewsCount: index,
          })
        )
      )
      const response = await request(fixture.baseUrl, cookie, '/admin/posts/reorder', 'POST', {
        ids: [records[3]!.id, records[2]!.id],
        offset: 2,
      })
      assert.equal(response.status, 204, await response.clone().text())
      await Promise.all(records.map((record) => record.refresh()))
      assert.deepEqual(
        records.map((record) => record.viewsCount),
        [0, 1, 3, 2]
      )
      assert.equal(records[0]!.viewsCount, 0)
      assert.equal(records[1]!.viewsCount, 1)
    } finally {
      await closeTestApp(fixture)
    }
  })
})
