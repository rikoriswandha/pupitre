import { test } from '@japa/runner'
import { z } from 'zod'
import vine from '@vinejs/vine'
import { defineCatalogExtension } from '../../../catalog/index.js'
import { action, defineColumn, defineEntry, defineField, schema } from '../../../index.js'
import {
  closeTestApp,
  createTestApp,
  fixturePanel,
  fixturePostResource,
  Post,
} from '../../helpers/app.js'

const extension = defineCatalogExtension({
  name: 'host-requirements',
  components: {
    HostScoreField: { kind: 'field', props: z.object({}), description: '' },
    HostScoreColumn: { kind: 'column', props: z.object({}), description: '' },
    HostScoreEntry: { kind: 'entry', props: z.object({}), description: '' },
  },
})
const field = defineField('hostScore', {
  extension,
  component: 'HostScoreField',
  validate: () => vine.number(),
})
const column = defineColumn('hostScore', { extension, component: 'HostScoreColumn' })
const entry = defineEntry('hostScore', { extension, component: 'HostScoreEntry' })
const rate = action('host-rate')
  .form([schema.repeater('items').schema([field('score')])])
  .handle(async () => {})

test('HTTP pages and action JSON declare host extensions without a panel plugin', async ({
  assert,
}) => {
  const fixture = await createTestApp({
    panels: {
      admin: async () => ({
        default: fixturePanel.resources({
          posts: fixturePostResource
            .form((form) => form.components([schema.repeater('items').schema([field('score')])]))
            .table((table) => table.columns([column('viewsCount')]))
            .infolist((infolist) =>
              infolist.components([schema.repeatableEntry('items').schema([entry('qty')])])
            )
            .actions({ row: [rate] }),
        }),
      }),
    },
  })
  try {
    const post = await Post.create({
      title: 'Extension post',
      slug: 'extension-requirements',
      status: 'draft',
      tenantId: 1,
      viewsCount: 3,
      items: [{ sku: 'A', qty: 1 }],
    })
    for (const [path, component] of [
      ['/admin/posts/create', 'HostScoreField'],
      ['/admin/posts', 'HostScoreColumn'],
      [`/admin/posts/${post.id}`, 'HostScoreEntry'],
    ]) {
      const response = await fetch(`${fixture.baseUrl}${path}`, {
        headers: { 'Accept': 'application/json', 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
      })
      assert.equal(response.status, 200, await response.clone().text())
      const body = (await response.json()) as { props: { page: { catalogExtensions: unknown } } }
      assert.deepEqual(body.props.page.catalogExtensions, [
        { name: extension.name, components: [component] },
      ])
    }
    const modal = await fetch(`${fixture.baseUrl}/admin/posts/${post.id}/actions/host-rate`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(modal.status, 200, await modal.clone().text())
    const body = (await modal.json()) as { catalogExtensions: unknown }
    assert.deepEqual(body.catalogExtensions, [
      { name: extension.name, components: ['HostScoreField'] },
    ])
  } finally {
    await closeTestApp(fixture)
  }
})

test('HTTP page declares extensions used only inside a Select create-option form', async ({
  assert,
}) => {
  const fixture = await createTestApp({
    panels: {
      admin: async () => ({
        default: fixturePanel.resources({
          posts: fixturePostResource.form((form) =>
            form.components([
              schema
                .select('categoryId')
                .options(async () => [])
                .createOptionForm([schema.repeater('items').schema([field('score')])]),
            ])
          ),
        }),
      }),
    },
  })
  try {
    const response = await fetch(`${fixture.baseUrl}/admin/posts/create`, {
      headers: { 'Accept': 'application/json', 'X-Inertia': 'true', 'X-Inertia-Version': '1' },
    })
    assert.equal(response.status, 200, await response.clone().text())
    const body = (await response.json()) as { props: { page: { catalogExtensions: unknown } } }
    assert.deepEqual(body.props.page.catalogExtensions, [
      { name: extension.name, components: ['HostScoreField'] },
    ])
  } finally {
    await closeTestApp(fixture)
  }
})
