import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import { schema } from '../../../index.js'
import { compileForm, compileInfolist } from '../../../src/compiler/schema_compiler.js'
import { SpecCache } from '../../../src/compiler/cache.js'
import type { SchemaNodeDefinition } from '../../../src/definition/schema.js'
import { actionDescriptor } from '../../../catalog/wire.js'

const form = { method: 'post' as const, url: '/save', submitLabel: 'Save', dirtyGuard: true }
const options = { locale: 'en', timezone: 'UTC', form }

function context(path: string, enabled: boolean): HttpContext {
  return {
    pupitre: {
      panel: {
        path,
        resources: [],
        pages: [
          {
            slug: 'settings',
            url: `${path}/settings`,
            definition: { actions: [{ name: 'save' }] },
          },
        ],
      },
    },
    bouncer: { allows: async () => enabled },
  } as unknown as HttpContext
}

test.group('Request-bound schema cache slots', () => {
  test('page actions and standalone links use current context on cache hits', async ({
    assert,
  }) => {
    const nodes: SchemaNodeDefinition[] = [
      {
        kind: 'select',
        name: 'setting',
        options: { x: 'X' },
        prefixAction: { name: 'save', kind: 'action', context: 'header', can: 'save' },
        suffixAction: {
          name: 'help',
          kind: 'action',
          context: 'header',
          url: ({ ctx }) => `${ctx?.pupitre.panel.path}/help`,
        },
      },
    ]
    const cache = { key: 'settings', store: new SpecCache() }
    const first = await compileForm(nodes, {
      ...options,
      cache,
      ctx: context('/first', true),
      resourceSlug: 'settings',
    })
    const second = await compileForm(nodes, {
      ...options,
      cache,
      ctx: context('/second', false),
      resourceSlug: 'settings',
    })
    const initial = actionDescriptor.parse(first.spec.elements['f.setting']!.props.prefixAction)
    const current = actionDescriptor.parse(second.spec.elements['f.setting']!.props.prefixAction)
    assert.equal(initial.url, '/first/settings/actions/save')
    assert.isTrue(initial.enabled)
    assert.equal(current.url, '/second/settings/actions/save')
    assert.isFalse(current.enabled)
    const help = actionDescriptor.parse(second.spec.elements['f.setting']!.props.suffixAction)
    assert.equal(help.url, '/second/help')
  })

  test('option endpoints, upload URLs and removed form props are request-local', async ({
    assert,
  }) => {
    const nodes = [
      schema
        .select('setting')
        .options(({ ctx }) => ({ x: ctx?.pupitre.panel.path ?? '' }))
        .toDefinition(),
      schema.fileUpload('file').toDefinition(),
      schema.markdownEditor('notes').toDefinition(),
    ]
    const cache = { key: 'urls', store: new SpecCache() }
    await compileForm(nodes, {
      ...options,
      form: { ...form, cancelUrl: '/first' },
      cache,
      ctx: context('/first', true),
      resourceSlug: 'settings',
      uploadUrls: { upload: '/first/upload', delete: '/first/delete' },
      record: { setting: 'x' },
    })
    const second = await compileForm(nodes, {
      ...options,
      cache,
      ctx: context('/second', false),
      resourceSlug: 'settings',
      uploadUrls: { upload: '/second/upload', delete: '/second/delete' },
      record: { setting: 'x' },
    })
    assert.equal(
      second.spec.elements['f.setting']!.props.optionsUrl,
      '/second/_pupitre/options/settings/setting'
    )
    assert.deepEqual(second.spec.elements['f.setting']!.props.options, [
      { value: 'x', label: '/second' },
    ])
    const upload = second.spec.elements['f.file']!.props.descriptor as {
      uploadUrl: string
      deleteUrl: string
    }
    assert.equal(upload.uploadUrl, '/second/upload')
    assert.equal(upload.deleteUrl, '/second/delete')
    assert.equal(second.spec.elements['f.notes']!.props.uploadUrl, '/second/upload')
    assert.isUndefined(second.spec.elements.root!.props.cancelUrl)
  })

  test('infolist file URL resolvers come from the current request', async ({ assert }) => {
    const nodes = [schema.imageEntry('image').toDefinition()]
    const cache = { key: 'image', store: new SpecCache() }
    await compileInfolist(nodes, {
      ...options,
      cache,
      record: { image: 'key-a' },
      resolveFileUrl: async (key) => `/first/${key}`,
    })
    const second = await compileInfolist(nodes, {
      ...options,
      cache,
      record: { image: 'key-b' },
      resolveFileUrl: async (key) => `/second/${key}`,
    })
    assert.equal(second.spec.elements['f.image']!.props.value, '/second/key-b')
  })
})
