import { test } from '@japa/runner'
import { definePage, defineResource, schema } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  denyPolicyAbility,
  fixturePanel,
  Post,
  PostPolicy,
  allowPolicyAbilities,
} from '../../helpers/app.js'

const resource = defineResource(Post)
  .slug('posts')
  .policy(PostPolicy)
  .scope((query) => query.where('tenant_id', 1))
  .form((form) =>
    form.components([
      schema
        .text('title')
        .live({ server: true })
        .afterStateUpdated(({ get, set, record, ctx }) => {
          set(
            'slug',
            `${String(get('title') ?? '')
              .toLowerCase()
              .replaceAll(' ', '-')}-${record ? 'edit' : 'new'}-${ctx?.request.method()}`
          )
          set('/meta/title', 'forbidden')
          set('/errors/title', 'forbidden')
          set('outside', 'forbidden')
          set('secret', 'forbidden')
          set('locked', 'forbidden')
        }),
      schema.text('slug'),
      schema.text('secret').hidden(() => true),
      schema.text('locked').disabled(true),
      schema.repeater('items').schema((fields) => [
        fields
          .text('name')
          .live({ server: true })
          .afterStateUpdated(({ get, set }) => {
            set('slug', String(get('name') ?? '').toUpperCase())
          }),
        fields.text('slug'),
      ]),
      schema.wizard([
        schema.step('Additional').components([
          schema
            .text('wizardName')
            .live({ server: true })
            .afterStateUpdated(({ get, set }) => set('slug', String(get('wizardName') ?? ''))),
        ]),
      ]),
      schema.builder('content').blocks([
        schema.block('heading').schema([
          schema
            .text('title')
            .live({ server: true })
            .afterStateUpdated(({ get, set }) =>
              set('title', String(get('title') ?? '').toUpperCase())
            ),
        ]),
      ]),
    ])
  )

const settings = definePage('settings')
  .path('/settings')
  .title('Settings')
  .form((s) => [
    s
      .text('label')
      .live({ server: true })
      .afterStateUpdated(({ get, set }) => set('slug', String(get('label') ?? '').toLowerCase())),
    s.text('slug'),
  ])

const panel = fixturePanel.resources({ posts: resource }).pages([settings])

async function request(baseUrl: string, payload: unknown) {
  const response = await fetch(`${baseUrl}/admin/_pupitre/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { response, body: (await response.json()) as { set?: Record<string, unknown> } }
}

test.group('server evaluation HTTP', () => {
  test('evaluates create, edit, and custom-page form closures with record and context', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const create = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'create',
        field: 'title',
        state: { title: 'New Title', excerpt: '', publishedAt: null, isFeatured: false },
      })
      assert.equal(create.response.status, 200)
      assert.deepEqual(create.body.set, { '/data/slug': 'new-title-new-POST' })
      const wizardField = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'create',
        field: 'wizardName',
        state: { wizardName: 'Wizard value' },
      })
      assert.equal(wizardField.response.status, 200)
      assert.deepEqual(wizardField.body.set, { '/data/slug': 'Wizard value' })
      const blockField = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'create',
        field: 'content.0.data.title',
        state: { content: [{ type: 'heading', data: { title: 'Block value' } }] },
      })
      assert.equal(blockField.response.status, 200)
      assert.deepEqual(blockField.body.set, { '/data/content/0/data/title': 'BLOCK VALUE' })

      const post = await Post.create({ title: 'Old', slug: 'old', tenantId: 1 })
      const edit = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'edit',
        record: post.id,
        field: 'title',
        state: { title: 'Edited Title' },
      })
      assert.equal(edit.response.status, 200)
      assert.deepEqual(edit.body.set, { '/data/slug': 'edited-title-edit-POST' })

      const page = await request(fixture.baseUrl, {
        resource: 'settings',
        page: 'page',
        field: 'label',
        state: { label: 'Custom Label' },
      })
      assert.equal(page.response.status, 200)
      assert.deepEqual(page.body.set, { '/data/slug': 'custom label' })
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('authorizes create and update and rejects unknown resources, fields, and foreign tenant records', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      denyPolicyAbility('create')
      const deniedCreate = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'create',
        field: 'title',
        state: { title: 'No' },
      })
      assert.equal(deniedCreate.response.status, 403)
      allowPolicyAbilities()

      const missingResource = await request(fixture.baseUrl, {
        resource: 'unknown',
        page: 'create',
        field: 'title',
        state: { title: 'No' },
      })
      assert.equal(missingResource.response.status, 404)
      const missingField = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'create',
        field: 'unknown',
        state: {},
      })
      assert.equal(missingField.response.status, 404)

      const foreign = await Post.create({ title: 'Foreign', slug: 'foreign', tenantId: 2 })
      const crossTenant = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'edit',
        record: foreign.id,
        field: 'title',
        state: { title: 'No' },
      })
      assert.equal(crossTenant.response.status, 404)

      const owned = await Post.create({ title: 'Owned', slug: 'owned', tenantId: 1 })
      denyPolicyAbility('update')
      const deniedUpdate = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'edit',
        record: owned.id,
        field: 'title',
        state: { title: 'No' },
      })
      assert.equal(deniedUpdate.response.status, 403)
    } finally {
      allowPolicyAbilities()
      await closeTestApp(fixture)
    }
  })

  test('restricts patches to visible enabled form fields and supports repeater-relative pointers', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels: { admin: async () => ({ default: panel }) } })
    try {
      const rejectedTargets = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'create',
        field: 'title',
        state: { title: 'abc' },
      })
      assert.equal(rejectedTargets.response.status, 200)
      assert.deepEqual(rejectedTargets.body.set, { '/data/slug': 'abc-new-POST' })

      const repeater = await request(fixture.baseUrl, {
        resource: 'posts',
        page: 'create',
        field: 'items.1.name',
        state: { items: [{ name: 'first' }, { name: 'second' }] },
      })
      assert.equal(repeater.response.status, 200)
      assert.deepEqual(repeater.body.set, { '/data/items/1/slug': 'SECOND' })
    } finally {
      await closeTestApp(fixture)
    }
  })
})
