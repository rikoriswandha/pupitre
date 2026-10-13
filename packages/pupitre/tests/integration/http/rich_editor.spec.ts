import { test } from '@japa/runner'
import {
  authorizeResource,
  definePanel,
  defineResource,
  mentionProvider,
  richBlock,
  schema,
  scopedQuery,
} from '../../../index.js'
import { optionsResponse } from '../../../catalog/wire.js'
import { z } from 'zod'
import {
  allowPolicyAbilities,
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixtureCategoryResource,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'
import type { TestApplication } from '../../helpers/app.js'
import { seed, teardown, truncate } from '../../helpers/db.js'

import RelationComment from '../../fixtures/models/relation_comment.js'
const callout = richBlock('callout').schema((fields) => [fields.text('title').required()])
const provider = mentionProvider('@').search(async (query, ctx) => {
  const owner = ctx.pupitre.panel.resources.find((resource) => resource.slug === 'categories')!
  if (!(await authorizeResource(ctx, owner, 'viewAny'))) return []
  const rows = await scopedQuery(ctx, owner).where('name', 'like', `%${query}%`)
  return rows.map((row) => ({
    id: Number(row.$getAttribute('id')),
    label: String(row.$getAttribute('name')),
  }))
})
const posts = fixturePostResource.form((form) =>
  form.components([
    form.text('title').required(),
    form.text('slug').required(),
    form.richEditor('body').mergeTags(['name']).mentions([provider]).customBlocks([callout]),
  ])
)
const panel = fixturePanel.resources({
  posts,
  categories: fixtureCategoryResource.scope((query) => query.where('tenant_id', 1)),
})
let fixture: TestApplication

test.group('rich editor options and save security', (group) => {
  group.setup(async () => {
    fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
  })
  group.each.setup(async () => {
    await truncate()
    allowPolicyAbilities()
  })
  group.teardown(async () => {
    allowPolicyAbilities()
    await closeTestApp(fixture)
    await teardown()
  })

  test('mention search uses the protected options transport and cannot disclose other-tenant choices', async ({
    assert,
  }) => {
    await seed({
      categories: [
        { name: 'Alice', tenantId: 1 },
        { name: 'Other tenant', tenantId: 2 },
      ],
    })
    const response = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/body?mention=%40&q=`,
      { headers: { Accept: 'application/json', Connection: 'close' } }
    )
    assert.equal(response.status, 200)
    const body = optionsResponse.parse(await response.json())
    assert.deepEqual(
      body.options.map((option) => option.label),
      ['Alice']
    )
    const hidden = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/body?mention=%40&q=Other`,
      { headers: { Accept: 'application/json', Connection: 'close' } }
    )
    assert.lengthOf(optionsResponse.parse(await hidden.json()).options, 0)
    denyPolicyAbility('create')
    denyPolicyAbility('update')
    const denied = await fetch(
      `${fixture.baseUrl}/admin/_pupitre/options/posts/body?mention=%40&q=Alice`,
      { headers: { Accept: 'application/json', Connection: 'close' } }
    )
    assert.equal(denied.status, 403)
  })

  test('invalid block configuration returns HTTP 422 identifying the nested rich-editor field', async ({
    assert,
  }) => {
    const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      body: JSON.stringify({
        title: 'Rich post',
        slug: 'rich-post',
        body: '<div data-type="customBlock" data-id="callout" data-config="{}"></div>',
      }),
    })
    assert.equal(response.status, 422, await response.clone().text())
    const failure = z
      .object({ errors: z.array(z.object({ field: z.string() })) })
      .parse(await response.json())
    assert.include(
      failure.errors.map((issue) => issue.field),
      'body.blocks.0.title'
    )
  })

  test('saving cannot persist a forged mention from another tenant', async ({ assert }) => {
    await seed({ categories: [{ name: 'Other tenant', tenantId: 2 }] })
    const response = await fetch(`${fixture.baseUrl}/admin/posts`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      body: JSON.stringify({
        title: 'Rich post',
        slug: 'rich-post',
        body: '<p><span data-type="mention" data-id="1" data-label="Other tenant" data-char="@">@Other tenant</span></p>',
      }),
    })
    assert.equal(response.status, 302, await response.clone().text())
    const saved = await Post.findByOrFail('slug', 'rich-post')
    assert.notInclude(saved.$getAttribute('body'), 'data-type="mention"')
    assert.include(saved.$getAttribute('body'), 'Other tenant')
  })

  test('edit mention search resolves a scoped record and requires its update ability', async ({
    assert,
  }) => {
    const record = await Post.create({ title: 'Own', slug: 'own', tenantId: 1 })
    const outside = await Post.create({ title: 'Other', slug: 'other', tenantId: 2 })
    const search = (id: string | number) =>
      fetch(`${fixture.baseUrl}/admin/_pupitre/options/posts/body?mention=%40&record=${id}`, {
        headers: { Accept: 'application/json', Connection: 'close' },
      })
    denyPolicyAbility('create')
    const own = await search(record.id)
    const hidden = await search(outside.id)
    const invalid = await search('not-an-id')
    assert.equal(own.status, 200)
    assert.equal(hidden.status, 404)
    assert.equal(invalid.status, 404)
    denyPolicyAbility('update')
    const denied = await search(record.id)
    assert.equal(denied.status, 403)
  })
})

test('updating an optional empty rich editor preserves an empty string in a NOT NULL column', async ({
  assert,
}) => {
  const resource = defineResource(RelationComment)
    .slug('comments')
    .form(() => [schema.text('title').required(), schema.richEditor('body')])
  const app = await createTestApp({
    panels: { admin: async () => ({ default: definePanel('admin').resources([resource]) }) },
  })
  try {
    const comment = await RelationComment.create({ title: 'Original', body: 'Old content' })
    const response = await fetch(`${app.baseUrl}/admin/comments/${comment.id}`, {
      method: 'PUT',
      redirect: 'manual',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated', body: '' }),
    })
    assert.equal(response.status, 302, await response.text())
    await comment.refresh()
    assert.equal(comment.title, 'Updated')
    assert.strictEqual(comment.body, '')
  } finally {
    await closeTestApp(app)
  }
})
