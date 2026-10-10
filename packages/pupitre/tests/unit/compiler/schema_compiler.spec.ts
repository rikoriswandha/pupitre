import { test } from '@japa/runner'
import { schema } from '../../../index.js'
import { compileForm, compileInfolist } from '../../../src/compiler/schema_compiler.js'
import { SpecCache } from '../../../src/compiler/cache.js'
import { liftClosure } from '../../../src/compiler/closure_lifter.js'
import type { SchemaNodeDefinition } from '../../../src/definition/schema.js'
import { E_PUPITRE_UNLIFTABLE_CLOSURE } from '../../../src/errors.js'

const options = {
  locale: 'en',
  timezone: 'Asia/Jakarta',
  form: { method: 'post' as const, url: '/posts', submitLabel: 'Create', dirtyGuard: true },
}
const node = (builder: { toDefinition(): unknown }) =>
  builder.toDefinition() as SchemaNodeDefinition

test.group('schema compiler', () => {
  test('compiles a form, nested repeaters, defaults and snapshots its json-render spec', async ({
    assert,
  }) => {
    const nodes = [
      node(
        schema
          .section('Content')
          .columns(2)
          .components([
            schema.text('title').required(),
            schema.select('status').options({ draft: 'Draft', published: 'Published' }),
            schema
              .repeater('items')
              .schema([
                schema.text('sku').required(),
                schema.repeater('variants').schema([schema.number('qty')]),
              ])
              .reorderable()
              .collapsible(),
          ])
      ),
      node(
        schema.tabs([
          schema.tab('Publishing').components([schema.dateTime('publishedAt')]),
          schema.tab('Details').components([schema.text('slug')]),
        ])
      ),
    ]
    const compiled = await compileForm(nodes, { ...options, data: { items: [{ sku: 'A' }] } })
    assert.snapshot(compiled.spec).match()
    assert.equal(compiled.spec.elements['f.items.variants.item']?.type, 'RepeaterItem')
    assert.equal(compiled.spec.elements['f.items.sku']?.props.error, undefined)
    assert.equal(compiled.state.data && typeof compiled.state.data, 'object')
  })

  test('compiles options and field bindings with catalog-valid element types', async ({
    assert,
  }) => {
    const compiled = await compileForm(
      [node(schema.select('status').options({ draft: 'Draft' }))],
      options
    )
    assert.deepEqual(compiled.spec.elements['f.status']?.props.options, [
      { value: 'draft', label: 'Draft' },
    ])
    assert.snapshot(compiled.spec).match()
    assert.deepEqual(compiled.spec.elements['f.status']?.props.value, {
      $bindState: '/data/status',
    })
  })

  test('lifts supported closures and marks record access static', ({ assert }) => {
    const scope = { pathPrefix: '/data', inRepeater: false }
    const getter = { get: (_path: string): number | string | boolean => 1 }
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => get('status') === 'published', 'visible', scope),
      { kind: 'expression', value: { $state: '/data/status', eq: 'published' } }
    )
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => get('a') && get('b') !== 'x', 'visible', scope),
      {
        kind: 'expression',
        value: { $and: [{ $state: '/data/a' }, { $state: '/data/b', neq: 'x' }] },
      }
    )
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => `Hello ${get('name')}`, 'label', scope),
      { kind: 'expression', value: { $template: 'Hello ${/data/name}' } }
    )
    assert.deepEqual(
      liftClosure(
        ({ get }: { get(path: string): number }) => get('qty') * get('price'),
        'content',
        scope
      ),
      {
        kind: 'computed',
        value: {
          $computed: 'mul',
          args: { a: { $state: '/data/qty' }, b: { $state: '/data/price' } },
        },
      }
    )
    assert.equal(
      liftClosure(
        ({ record }: { record: Record<string, unknown> | null }) => record?.isAdmin,
        'visible',
        scope
      ).kind,
      'static'
    )
    const scoped = liftClosure(({ get }: typeof getter) => get('qty'), 'visible', {
      pathPrefix: '/data/items',
      inRepeater: true,
    })
    assert.deepEqual(scoped.kind === 'static' ? undefined : scoped.value, { $item: 'qty' })
    assert.equal(
      liftClosure(({ get }: typeof getter) => slugify(get('title')), 'visible', scope).kind,
      'static'
    )
    assert.equal(
      liftClosure(({ get }: typeof getter) => slugify(get('title')), 'afterStateUpdated', scope)
        .kind,
      'static'
    )
  })
  test('compiles afterStateUpdated expressions to watch actions and rejects unliftable handlers', async ({
    assert,
  }) => {
    const update = node(
      schema.text('title').afterStateUpdated(({ set, get }) => set('slug', get('title')))
    )
    const compiled = await compileForm([update], options)
    assert.deepEqual(compiled.spec.elements['f.title']?.watch, {
      '/data/title': [
        {
          action: 'setState',
          params: { statePath: '/data/slug', value: { $state: '/data/title' } },
        },
      ],
    })
    const invalid = node(
      schema.text('title').afterStateUpdated(({ set }) => set('slug', slugify('Title')))
    )
    let failure: unknown
    try {
      await compileForm([invalid], options)
    } catch (error) {
      failure = error
    }
    assert.instanceOf(failure, E_PUPITRE_UNLIFTABLE_CLOSURE)
    assert.include(String(failure), 'title')
  })

  test('repeater placeholders lift arithmetic to a catalog-valid $computed with item args', async ({
    assert,
  }) => {
    const items = node(
      schema
        .repeater('items')
        .schema([
          schema.number('qty'),
          schema.number('price'),
          schema.placeholder('subtotal').content(({ get }) => get('qty') * get('price')),
        ])
    )
    const compiled = await compileForm([items], options)
    const placeholder = Object.values(compiled.spec.elements).find(
      (element) => element.type === 'Placeholder'
    )
    assert.deepEqual(placeholder?.props.content, {
      $computed: 'mul',
      args: { a: { $item: 'qty' }, b: { $item: 'price' } },
    })
  })

  test('normalizes record dates nested in layouts to the form timezone', async ({ assert }) => {
    const nodes = [
      node(
        schema.tabs([
          schema
            .tab('Publishing')
            .components([schema.dateTime('publishedAt'), schema.date('embargoOn')]),
        ])
      ),
    ]
    const compiled = await compileForm(nodes, {
      ...options,
      data: { publishedAt: '2026-10-07T12:00:00.000+00:00', embargoOn: '2026-10-07' },
    })
    assert.deepInclude(compiled.state.data, {
      publishedAt: '2026-10-07T19:00:00+07:00',
      embargoOn: '2026-10-07',
    })
  })

  test('cache specs are cloned and evaluate static closures for each record', async ({
    assert,
  }) => {
    const cache = new SpecCache()
    const nodes = [
      node(
        schema
          .placeholder('greeting')
          .content(
            ({ record }: { record: Record<string, unknown> | null }) => `Hello ${record?.name}`
          )
      ),
    ]
    const first = await compileForm(nodes, {
      ...options,
      cache: { key: 'admin:posts:create:en:hash', store: cache },
      record: { name: 'Ada' },
    })
    const cached = cache.get('admin:posts:create:en:hash')
    const second = await compileForm(nodes, {
      ...options,
      cache: { key: 'admin:posts:create:en:hash', store: cache },
      record: { name: 'Grace' },
    })
    assert.equal(first.spec.elements['l.0']?.props.content, 'Hello Ada')
    assert.equal(second.spec.elements['l.0']?.props.content, 'Hello Grace')
    assert.notStrictEqual(second.spec, cached?.spec)
    assert.equal(
      cached?.spec && (cached.spec as typeof first.spec).elements['l.0']?.props.content,
      undefined
    )
  })

  test('renders formatted infolist date entries in the requested timezone', async ({ assert }) => {
    const entry = node(schema.textEntry('publishedAt').dateTime('yyyy-MM-dd HH:mm'))
    const compiled = await compileInfolist([entry], {
      locale: 'en',
      timezone: 'Asia/Jakarta',
      record: { publishedAt: '2025-01-01T00:00:00Z' },
    })
    assert.snapshot(compiled.spec).match()
    assert.equal(compiled.spec.elements['f.publishedAt']?.props.value, '2025-01-01 07:00')
  })

  test('formats DST-boundary values in the requested zone', async ({ assert }) => {
    const entry = node(schema.textEntry('publishedAt').dateTime('yyyy-MM-dd HH:mm ZZZZ'))
    const compiled = await compileInfolist([entry], {
      locale: 'en',
      timezone: 'Europe/Amsterdam',
      record: { publishedAt: '2024-10-27T01:30:00Z' },
    })
    assert.equal(compiled.spec.elements['f.publishedAt']?.props.value, '2024-10-27 02:30 GMT+1')
  })
})

function slugify(value: unknown) {
  return String(value).toLowerCase()
}
