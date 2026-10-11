import { test } from '@japa/runner'
import { action, definePage, schema } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'

const contentBuilder = schema.builder('content').blocks([
  schema
    .block('heading')
    .label('Heading')
    .schema((fields) => [fields.text('title').required()]),
  schema
    .block('paragraph')
    .label('Paragraph')
    .schema((fields) => [fields.textarea('body').required()]),
])
const wizardAction = action('wizard')
  .label('Wizard action')
  .form([
    schema.wizard([
      schema.step('Details').components([schema.text('first').required()]),
      schema.step('Confirm').components([schema.text('second').required()]),
    ]),
  ])
  .handle(async () => {})
const builderPage = definePage('builder')
  .path('/builder')
  .title('Builder')
  .form((fields) => [
    fields.wizard([
      fields.step('Details').components([fields.text('first').required()]),
      fields.step('Confirm').components([fields.text('second').required()]),
    ]),
  ])
  .save(async () => {})
  .actions([wizardAction])
const panels = {
  admin: async () => ({
    default: fixturePanel
      .resources({
        posts: fixturePostResource.form((fields) =>
          fields.components([
            schema.text('title').required(),
            schema.text('slug').required(),
            contentBuilder,
          ])
        ),
      })
      .pages([builderPage]),
  }),
}

async function postJson(baseUrl: string, path: string, data: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Pupitre-Action': '1',
    },
    body: JSON.stringify(data),
  })
}

test.group('Builder and Wizard HTTP integration', () => {
  test('creates and updates builder JSON, validates nested fields, and rejects unknown blocks', async ({
    assert,
  }) => {
    const fixture = await createTestApp({ panels })
    try {
      const initial = [
        { type: 'heading', data: { title: 'Welcome' } },
        { type: 'paragraph', data: { body: 'First body' } },
      ]
      const created = await postJson(fixture.baseUrl, '/admin/posts', {
        title: 'Builder post',
        slug: 'builder-post',
        content: initial,
      })
      assert.equal(created.status, 200, await created.clone().text())
      const createdBody = (await created.json()) as { redirect?: string; data?: { id?: number } }
      const row = await Post.query().where('slug', 'builder-post').firstOrFail()
      assert.deepEqual(row.content, initial)
      assert.isString(createdBody.redirect)

      const updated = await fetch(`${fixture.baseUrl}/admin/posts/${row.id}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Pupitre-Action': '1',
        },
        body: JSON.stringify({
          title: 'Updated builder post',
          slug: 'builder-post',
          content: [{ type: 'heading', data: { title: 'Updated' } }],
        }),
      })
      assert.equal(updated.status, 200, await updated.clone().text())
      await row.refresh()
      assert.deepEqual(row.content, [{ type: 'heading', data: { title: 'Updated' } }])

      const invalid = await postJson(fixture.baseUrl, '/admin/posts', {
        title: 'Invalid builder',
        slug: 'invalid-builder',
        content: [{ type: 'heading', data: {} }],
      })
      assert.equal(invalid.status, 422)
      const invalidBody = (await invalid.json()) as { errors: Record<string, string[]> }
      assert.include(Object.keys(invalidBody.errors), 'content.0.data.title')

      const unknown = await postJson(fixture.baseUrl, '/admin/posts', {
        title: 'Unknown builder',
        slug: 'unknown-builder',
        content: [{ type: 'missing', data: { title: 'Nope' } }],
      })
      assert.equal(unknown.status, 422)
      const unknownBody = (await unknown.json()) as { errors: Record<string, string[]> }
      assert.include(Object.keys(unknownBody.errors), 'content.0.type')
    } finally {
      await closeTestApp(fixture)
    }
  })

  test('wizard action form returns the JSON validation error shape', async ({ assert }) => {
    const fixture = await createTestApp({ panels })
    try {
      const form = await fetch(`${fixture.baseUrl}/admin/builder/actions/wizard`, {
        headers: { Accept: 'application/json' },
      })
      assert.equal(form.status, 200)
      const formBody = (await form.json()) as {
        spec: { elements: Record<string, { type: string }> }
      }
      assert.include(
        Object.values(formBody.spec.elements).map((element) => element.type),
        'Wizard'
      )

      const invalid = await fetch(`${fixture.baseUrl}/admin/builder/actions/wizard`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Pupitre-Action': '1',
        },
        body: JSON.stringify({ data: {} }),
      })
      assert.equal(invalid.status, 422)
      const body = (await invalid.json()) as { errors: Record<string, string[]> }
      assert.property(body.errors, 'first')
      assert.property(body.errors, 'second')
    } finally {
      await closeTestApp(fixture)
    }
  })
})
