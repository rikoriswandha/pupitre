import { test } from '@japa/runner'
import { closeTestApp, createTestApp } from '../../helpers/app.js'
import {
  actions,
  definePanel,
  defineRelationManager,
  defineResource,
  pages,
  schema,
} from '../../../index.js'
import { table } from '../../../index.js'
import RelationPost from '../../fixtures/models/relation_post.js'
import RelationRevision from '../../fixtures/models/relation_revision.js'
import { Post } from '../../helpers/app.js'
import { lookupOrNull } from '../../../src/query/record_lookup.js'

test.group('invalid resource record IDs', () => {
  test('identifier normalization only suppresses PostgreSQL invalid-identifier errors', async ({
    assert,
  }) => {
    const malformed = Object.assign(new Error('invalid identifier'), { code: '22P02' })
    assert.isNull(
      await lookupOrNull(async () => {
        throw malformed
      })
    )
    const failure = Object.assign(new Error('database unavailable'), { code: '42P01' })
    await assert.rejects(
      () =>
        lookupOrNull(async () => {
          throw failure
        }),
      /database unavailable/
    )
  })

  test('returns not found across integer record CRUD and action routes', async ({ assert }) => {
    const fixture = await createTestApp()
    try {
      for (const [method, path] of [
        ['GET', '/admin/posts/not-an-integer'],
        ['GET', '/admin/posts/not-an-integer/edit'],
        ['PUT', '/admin/posts/not-an-integer'],
        ['DELETE', '/admin/posts/not-an-integer'],
        ['GET', '/admin/posts/not-an-integer/actions/publish'],
        ['POST', '/admin/posts/not-an-integer/actions/publish'],
      ]) {
        const response = await fetch(`${fixture.baseUrl}${path}`, {
          method,
          redirect: 'manual',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          ...(['PUT', 'POST'].includes(method) ? { body: '{}' } : {}),
        })
        assert.equal(response.status, 404, `${method} ${path}: ${await response.text()}`)
      }
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('malformed IDs return 404 for relations, nested parents, uploads and bulk selections', async ({
    assert,
  }) => {
    const comments = defineRelationManager(RelationPost, 'revisions')
      .recordTitle('title')
      .form(() => [schema.text('title')])
      .actions({
        header: [actions.associate()],
        row: [actions.edit(), actions.delete(), actions.dissociate()],
        bulk: [actions.bulkDissociate()],
      })
    const revisions = defineResource(RelationRevision)
      .slug('revisions')
      .parent(RelationPost, 'post')
      .form(() => [schema.text('title')])
      .actions({ header: [actions.create()] })
      .pages({ list: pages.list(), create: pages.create() })
    const tags = defineRelationManager(RelationPost, 'tags').actions({
      header: [actions.attach()],
      bulk: [actions.bulkDetach()],
    })
    const posts = defineResource(RelationPost)
      .slug('relation-posts')
      .relations([comments, tags])
      .nested([revisions])
      .pages({ list: pages.list(), view: pages.view() })
    const uploads = defineResource(Post)
      .slug('uploads')
      .form(() => [schema.fileUpload('cover')])
      .table((builder) => builder.columns([table.text('title')]).reorderable('viewsCount'))
      .actions({ bulk: [actions.bulk('selected').handle(() => {})] })
      .pages({ list: pages.list() })
    const fixture = await createTestApp({
      panels: {
        admin: async () => ({
          default: definePanel('admin').path('/admin').resources({ posts, uploads }),
        }),
      },
    })
    try {
      const parent = await RelationPost.create({ title: 'Parent', tenantId: 1 })
      for (const [method, path, body] of [
        ['GET', '/admin/relation-posts/not-an-integer/relations/revisions'],
        [
          'GET',
          `/admin/relation-posts/${parent.id}/relations/revisions/not-an-integer/actions/edit`,
        ],
        [
          'POST',
          `/admin/relation-posts/${parent.id}/relations/revisions/not-an-integer/actions/delete`,
          { data: {} },
        ],
        ['GET', '/admin/relation-posts/not-an-integer/revisions'],
        ['POST', '/admin/relation-posts/not-an-integer/revisions/actions/create', { data: {} }],
        [
          'POST',
          '/admin/_pupitre/upload',
          { resource: 'uploads', field: 'cover', record: 'not-an-integer' },
        ],
        ['POST', '/admin/uploads/actions/selected', { ids: ['not-an-integer'] }],
        ['POST', '/admin/uploads/reorder', { ids: ['not-an-integer'] }],
        ...['associate', 'bulk-dissociate'].map(
          (action) =>
            [
              'POST',
              `/admin/relation-posts/${parent.id}/relations/revisions/actions/${action}`,
              { data: { ids: ['not-an-integer'] } },
            ] as const
        ),
        ...['attach', 'bulk-detach'].map(
          (action) =>
            [
              'POST',
              `/admin/relation-posts/${parent.id}/relations/tags/actions/${action}`,
              { data: { ids: ['not-an-integer'] } },
            ] as const
        ),
      ] as const) {
        const response = await fetch(`${fixture.baseUrl}${path}`, {
          method,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Pupitre-Action': '1',
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        })
        assert.equal(response.status, 404, `${method} ${path}: ${await response.text()}`)
      }
      for (const [relation, action] of [
        ['revisions', 'associate'],
        ['tags', 'attach'],
      ]) {
        const response = await fetch(
          `${fixture.baseUrl}/admin/relation-posts/${parent.id}/relations/${relation}/actions/${action}/options?selected=not-an-integer`,
          { headers: { Accept: 'application/json' } }
        )
        assert.equal(response.status, 200, await response.clone().text())
        assert.deepEqual(((await response.json()) as { options: unknown[] }).options, [])
      }
    } finally {
      await closeTestApp(fixture)
    }
  })
})
