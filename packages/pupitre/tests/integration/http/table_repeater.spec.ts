import { test } from '@japa/runner'
import { definePanel, defineResource, pages, schema } from '../../../index.js'
import type { TenancyAdapter } from '../../../src/definition/tenancy.js'
import {
  closeTestApp,
  createTestApp,
  Post,
  PostPolicy,
  User,
  denyPolicyAbility,
  allowPolicyAbilities,
} from '../../helpers/app.js'
import { submitForm, visitResource } from '../../../testing/index.js'
import { truncate } from '../../helpers/db.js'
import PostLink from '../../fixtures/models/post_link.js'
import { repeaterDescriptor } from '../../../catalog/wire.js'

const resource = defineResource(Post)
  .slug('posts')
  .policy(PostPolicy)
  .form((s) => [
    s.text('title').required(),
    s.text('slug').required(),
    s
      .repeater('items')
      .schema([schema.text('sku').required(), schema.number('qty').min(1)])
      .table()
      .reorderable(),
    s
      .repeater('links')
      .schema([schema.text('label').required(), schema.text('url').required()])
      .relationship('links', { orderColumn: 'sort' })
      .table()
      .reorderable()
      .cloneable(),
  ])
  .pages({ create: pages.create(), edit: pages.edit(), list: pages.list() })
const adapter: TenancyAdapter = {
  async resolve(ctx) {
    return ctx.params.tenant === 'acme' ? { id: 1, name: 'Acme', slug: 'acme' } : null
  },
  scope(query, tenant, options) {
    query.where(options.ownership, tenant.id)
  },
  fill(data, tenant) {
    return { ...data, tenantId: tenant.id }
  },
  async listForUser() {
    return [{ id: 1, name: 'Acme', slug: 'acme' }]
  },
}
const panel = definePanel('admin')
  .path('/admin')
  .tenancy({ mode: 'url', adapter })
  .resources({ posts: resource })

test.group('Table repeater HTTP security and persistence', () => {
  test('preserves nested 422 paths, transactional relationships and authorization/tenant boundaries', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      await truncate()
      const actor = await User.create({
        name: 'Table repeater',
        email: 'table-repeater@example.test',
      })
      const tenant = { id: 1, name: 'Acme', slug: 'acme' }
      const context = { app: fixture.app, user: actor, tenant }
      const invalid = await submitForm(
        'posts',
        'create',
        {
          title: 'Table',
          slug: 'table',
          items: [{ sku: 'A', qty: 1 }, { qty: 0 }],
        },
        context
      )
      assert.equal(invalid.status, 422)
      invalid.assertErrors({ 'items.1.sku': 'defined', 'items.1.qty': 'at least 1' })
      const created = await submitForm(
        'posts',
        'create',
        {
          title: 'Table',
          slug: 'table',
          items: [
            { sku: 'A', qty: 1 },
            { sku: 'B', qty: 2 },
          ],
          links: [{ label: 'Own', url: 'https://example.test' }],
        },
        context
      )
      created.assertOk()
      const record = created.record
      assert.isDefined(record)
      if (!record) throw new Error('Missing created record')
      const edit = await visitResource('posts', 'edit', { ...context, record })
      assert.lengthOf(
        repeaterDescriptor.parse(edit.spec.elements['f.items'].props.descriptor).table ?? [],
        2
      )
      const ownLink = await PostLink.query()
        .where('postId', record.$getAttribute('id'))
        .firstOrFail()
      const foreign = await Post.create({
        title: 'Foreign',
        slug: 'foreign-table',
        status: 'draft',
        tenantId: 2,
      })
      const foreignLink = await PostLink.create({
        postId: foreign.id,
        label: 'Foreign',
        url: 'https://foreign.test',
        sort: 0,
      })
      await assert.rejects(
        () => visitResource('posts', 'edit', { ...context, record: foreign }),
        /HTTP 404/
      )
      await assert.rejects(() =>
        submitForm(
          'posts',
          'edit',
          {
            title: 'Hijack',
            slug: 'table',
            links: [{ _relationKey: foreignLink.id, label: 'Hijack', url: 'https://hijack.test' }],
          },
          { ...context, record }
        )
      )
      await foreignLink.refresh()
      assert.equal(foreignLink.label, 'Foreign')
      const updated = await submitForm(
        'posts',
        'edit',
        {
          title: 'Table',
          slug: 'table',
          links: [
            { label: 'New', url: 'https://new.test' },
            { _relationKey: ownLink.id, label: 'Own updated', url: 'https://example.test' },
          ],
        },
        { ...context, record }
      )
      updated.assertOk()
      await ownLink.refresh()
      assert.equal(ownLink.sort, 1)
      assert.equal(ownLink.label, 'Own updated')
      denyPolicyAbility('create')
      await assert.rejects(() =>
        submitForm('posts', 'create', { title: 'Denied', slug: 'denied-table' }, context)
      )
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })
})
