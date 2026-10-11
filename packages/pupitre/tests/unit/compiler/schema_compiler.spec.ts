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
  test('emits repeater addLabel and grid descriptors supported by the wire schema', async ({
    assert,
  }) => {
    const compiled = await compileForm(
      [
        node(
          schema
            .repeater('items')
            .schema([schema.text('name')])
            .addLabel('Add item')
            .grid(2)
        ),
      ],
      options
    )
    const descriptor = compiled.spec.elements['f.items']?.props.descriptor as
      Record<string, unknown> | undefined
    assert.equal(descriptor?.addLabel, 'Add item')
    assert.equal(descriptor?.grid, 2)
  })
  test('emits section icons, inline checkbox/toggle props, and toggle colors', async ({
    assert,
  }) => {
    const compiled = await compileForm(
      [
        node(
          schema
            .section('Details')
            .icon('book')
            .components([
              schema.checkbox('published').inline(),
              schema.toggle('enabled').inline().onColor('green').offColor('gray'),
            ])
        ),
      ],
      options
    )
    const section = Object.values(compiled.spec.elements).find(
      (element) => element.type === 'Section'
    )
    assert.equal(section?.props.icon, 'book')
    assert.equal(compiled.spec.elements['f.published']?.props.inline, true)
    assert.equal(compiled.spec.elements['f.enabled']?.props.inline, true)
    assert.equal(compiled.spec.elements['f.enabled']?.props.onColor, 'green')
    assert.equal(compiled.spec.elements['f.enabled']?.props.offColor, 'gray')
  })

  test('places repeater item label expressions in the item template scope', async ({ assert }) => {
    const compiled = await compileForm(
      [
        node(
          schema
            .repeater('items')
            .schema([schema.text('sku')])
            .itemLabel(({ get }) => `SKU ${get('sku')}`)
        ),
      ],
      { ...options, data: { items: [{ sku: 'A' }, { sku: 'B' }] } }
    )
    const repeater = compiled.spec.elements['f.items']
    const item = compiled.spec.elements['f.items.item']
    assert.notProperty((repeater?.props.descriptor ?? {}) as object, 'itemLabel')
    assert.deepEqual(item?.props.itemLabel, { $template: 'SKU ${sku}' })
    assert.deepEqual(item?.props.index, { $index: true })
  })
  test('lifts repeater item-label ternaries with comparison tests', async ({ assert }) => {
    const compiled = await compileForm(
      [
        node(
          schema
            .repeater('items')
            .schema([schema.number('qty')])
            .itemLabel(({ get }) => ((get('qty') as number) > 0 ? 'In stock' : 'Empty'))
        ),
      ],
      { ...options, data: { items: [{ qty: 1 }] } }
    )
    assert.deepEqual(compiled.spec.elements['f.items.item']?.props.itemLabel, {
      $cond: { $item: 'qty', gt: 0 },
      $then: 'In stock',
      $else: 'Empty',
    })
  })
  test('rejects repeater item labels that cannot be lifted into item scope', async ({ assert }) => {
    let failure: unknown
    try {
      await compileForm(
        [
          node(
            schema
              .repeater('items')
              .schema([schema.text('sku')])
              .itemLabel(({ get }) => 'SKU ' + (get('sku') || 'unknown'))
          ),
        ],
        options
      )
    } catch (error) {
      failure = error
    }
    assert.instanceOf(failure, E_PUPITRE_UNLIFTABLE_CLOSURE)
  })

  test('keeps time field wall-clock values on the form load path', async ({ assert }) => {
    const compiled = await compileForm([node(schema.time('opensAt'))], {
      ...options,
      data: { opensAt: '09:30' },
    })
    assert.equal((compiled.state.data as Record<string, unknown>).opensAt, '09:30')
  })

  test('resolves each image-entry key and preserves external URLs', async ({ assert }) => {
    const compiled = await compileInfolist([node(schema.imageEntry('avatars'))], {
      ...options,
      record: { avatars: ['stored/key.png', 'https://example.test/avatar.png'] },
      resolveFileUrl: async (key) =>
        key === 'stored/key.png' ? 'https://cdn.test/avatar.png' : null,
    })
    assert.deepEqual(compiled.spec.elements['f.avatars']?.props.value, [
      'https://cdn.test/avatar.png',
      'https://example.test/avatar.png',
    ])
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

  test('compiles actions on selects with static options', async ({ assert }) => {
    const compiled = await compileForm(
      [
        node(
          schema.select('status').options({ draft: 'Draft' }).suffixAction({
            name: 'help',
            kind: 'action',
            context: 'header',
            url: '/help',
          })
        ),
      ],
      {
        ...options,
        ctx: { pupitre: { panel: { path: '/admin' } } } as never,
      }
    )
    assert.deepEqual(compiled.spec.elements['f.status']?.props.suffixAction, {
      name: 'help',
      label: 'help',
      kind: 'link',
      url: '/help',
      method: 'get',
      enabled: true,
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
      liftClosure(
        ({ get }: typeof getter) => (get('type') === 'company' ? 'Company name' : 'Full name'),
        'label',
        scope
      ),
      {
        kind: 'expression',
        value: {
          $cond: { $state: '/data/type', eq: 'company' },
          $then: 'Company name',
          $else: 'Full name',
        },
      }
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
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => get('a') || get('b') === 'yes', 'visible', scope),
      {
        kind: 'expression',
        value: { $or: [{ $state: '/data/a' }, { $state: '/data/b', eq: 'yes' }] },
      }
    )
  })
  test('lifts boolean expressions for value props and keeps ambiguous values static', ({
    assert,
  }) => {
    const scope = { pathPrefix: '/data', inRepeater: false }
    const getter = { get: (_path: string): unknown => 1 }
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => get('status') === 'published', 'disabled', scope),
      {
        kind: 'expression',
        value: { $cond: { $state: '/data/status', eq: 'published' }, $then: true, $else: false },
      }
    )
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => get('enabled'), 'disabled', scope),
      {
        kind: 'expression',
        value: { $cond: { $state: '/data/enabled' }, $then: true, $else: false },
      }
    )
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => get('enabled') === true, 'label', scope),
      {
        kind: 'expression',
        value: { $cond: { $state: '/data/enabled', eq: true }, $then: true, $else: false },
      }
    )
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => `Hello ${get('name')}`, 'content', scope),
      { kind: 'expression', value: { $template: 'Hello ${/data/name}' } }
    )
    assert.equal(
      liftClosure(({ get }: typeof getter) => get('name') || 'New', 'label', scope).kind,
      'static'
    )
    assert.equal(
      liftClosure(({ get }: typeof getter) => 'Name: ' + (get('name') || 'guest'), 'label', scope)
        .kind,
      'static'
    )
    assert.equal(
      liftClosure(
        ({ get }: typeof getter) => 'Status ' + (get('status') === 'open'),
        'label',
        scope
      ).kind,
      'static'
    )
    assert.equal(
      liftClosure(({ get }: typeof getter) => 'Value ' + (get('a') && get('b')), 'content', scope)
        .kind,
      'static'
    )
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => (get('qty') as number) + 2, 'content', {
        ...scope,
        numericFields: { qty: true },
      }),
      {
        kind: 'computed',
        value: { $computed: 'add', args: { a: { $state: '/data/qty' }, b: 2 } },
      }
    )
    assert.deepEqual(
      liftClosure(({ get }: typeof getter) => 'Hello ' + (get('name') as string), 'content', scope),
      {
        kind: 'computed',
        value: {
          $computed: 'concat',
          args: { values: ['Hello ', { $state: '/data/name' }] },
        },
      }
    )
    assert.deepEqual(
      liftClosure(
        ({ get }: typeof getter) => (get('qty') as number) + (get('price') as number),
        'content',
        { ...scope, numericFields: { qty: true, price: true } }
      ),
      {
        kind: 'computed',
        value: {
          $computed: 'add',
          args: { a: { $state: '/data/qty' }, b: { $state: '/data/price' } },
        },
      }
    )
    assert.equal(
      liftClosure(
        ({ get }: typeof getter) => (get('name') as string) + (get('suffix') as string),
        'content',
        scope
      ).kind,
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

  test('cache keeps record, URL and timezone values per request with one spec build', async ({
    assert,
  }) => {
    const cache = new SpecCache()
    let builds = 0
    const store = {
      get: (key: string) => cache.get(key),
      set: (key: string, value: Parameters<typeof cache.set>[1]) => {
        builds++
        cache.set(key, value)
      },
    } as SpecCache
    const nodes = [
      node(
        schema
          .placeholder('greeting')
          .content(
            ({ record }: { record: Record<string, unknown> | null }) => `Hello ${record?.name}`
          )
      ),
      node(schema.dateTime('scheduleAt')),
      node(schema.repeater('items').schema([schema.text('sku')])),
      node(schema.textEntry('name')),
      node(schema.textEntry('createdAt').dateTime('yyyy-MM-dd HH:mm')),
    ]
    const key = 'admin:posts:edit:en:hash'
    const first = await compileForm(nodes, {
      ...options,
      form: { ...options.form, method: 'put', url: '/posts/1', cancelUrl: '/posts/1' },
      timezone: 'Asia/Jakarta',
      cache: { key, store },
      record: { name: 'Ada', createdAt: '2025-01-01T00:00:00Z', items: [{ sku: 'A' }] },
    })
    const cached = cache.get(key)
    const cachedSpec = cached?.spec as typeof first.spec | undefined
    const second = await compileForm(nodes, {
      ...options,
      form: { ...options.form, method: 'put', url: '/posts/2', cancelUrl: '/posts/2' },
      timezone: 'America/Los_Angeles',
      cache: { key, store },
      record: { name: 'Grace', createdAt: '2025-01-02T00:00:00Z', items: [{ sku: 'B' }] },
    })
    assert.equal(builds, 1)
    assert.deepEqual(cachedSpec?.state?.data, {})
    const cachedMeta = cachedSpec?.state?.meta
    const cachedRecord =
      cachedMeta && typeof cachedMeta === 'object' && 'record' in cachedMeta
        ? cachedMeta.record
        : undefined
    assert.isNull(cachedRecord)
    assert.equal(first.spec.elements.root?.props.url, '/posts/1')
    assert.equal(second.spec.elements.root?.props.url, '/posts/2')
    assert.equal(second.spec.elements.root?.props.cancelUrl, '/posts/2')
    assert.equal(first.spec.elements['f.name']?.props.value, 'Ada')
    assert.equal(second.spec.elements['f.name']?.props.value, 'Grace')
    assert.equal(first.spec.elements['f.scheduleAt']?.props.timezone, 'Asia/Jakarta')
    assert.equal(second.spec.elements['f.scheduleAt']?.props.timezone, 'America/Los_Angeles')
    assert.deepEqual(
      (second.spec.elements['f.items']?.props.descriptor as { defaultItems: unknown[] })
        .defaultItems,
      [{ sku: 'B' }]
    )
    assert.equal(second.spec.elements['l.0']?.props.content, 'Hello Grace')
    assert.equal(second.spec.elements['f.createdAt']?.props.value, '2025-01-01 16:00')
    assert.notStrictEqual(second.spec, cachedSpec)
    assert.equal(cachedSpec?.elements.root?.props.url, undefined)
    assert.equal(cachedSpec?.elements['f.name']?.props.value, undefined)
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
  test('snapshots every compiler-emitted catalog component and complete view entries', async ({
    assert,
  }) => {
    const nodes = [
      schema.text('text'),
      schema.email('email'),
      schema.password('password'),
      schema.number('number'),
      schema.textarea('textarea'),
      schema.hidden('hidden'),
      schema.select('select').options({ one: 'One' }),
      schema.multiSelect('multi').options({ one: 'One' }),
      schema.checkbox('checkbox'),
      schema.checkboxList('checklist').options({ one: 'One' }),
      schema.radio('radio').options({ one: 'One' }),
      schema.toggle('toggle'),
      schema.toggleButtons('buttons').options({ one: 'One' }),
      schema.date('date'),
      schema.dateTime('dateTime'),
      schema.time('time'),
      schema.color('color'),
      schema.tags('tags'),
      schema.keyValue('keyValue'),
      schema.richEditor('richEditor'),
      schema.fileUpload('fileUpload'),
      schema.repeater('repeater').schema([schema.text('item')]),
      schema
        .grid()
        .columns(2)
        .components([schema.text('gridText')]),
      schema.section('Section').components([schema.text('sectionText')]),
      schema.fieldset('Fieldset').components([schema.text('fieldsetText')]),
      schema.tabs([schema.tab('Details').components([schema.text('tabText')])]),
      schema.group('Group').components([schema.text('groupText')]),
      schema.split(schema.text('splitText')),
      schema.placeholder('placeholder').content('Static placeholder'),
      schema.html('<strong>Safe HTML</strong>'),
      schema.divider(),
      schema.view('HostWidget', { title: 'Widget' }),
      schema.fragment([schema.text('fragmentText')]),
    ].map(node)
    const compiled = await compileForm(nodes, {
      ...options,
      uploadUrls: { upload: '/upload', delete: '/upload' },
    })
    assert.snapshot(compiled.spec).match()

    const record = {
      text: 'Hello',
      icon: true,
      image: 'uploads/image.png',
      color: '#123456',
      metadata: { key: 'value' },
      history: [{ title: 'Change' }],
      source: 'const x = 1',
      status: 'published',
    }
    const view = await compileInfolist(
      [
        schema.textEntry('text'),
        schema.iconEntry('icon').boolean(),
        schema.imageEntry('image'),
        schema.colorEntry('color'),
        schema.keyValueEntry('metadata'),
        schema.repeatableEntry('history'),
        schema.codeEntry('source'),
        schema.badgeEntry('status'),
      ].map(node),
      { locale: 'en', timezone: 'Asia/Jakarta', record }
    )
    assert.snapshot(view.spec).match()
  })
  test('sanitizes Html closures server-side instead of lifting them', async ({ assert }) => {
    const html = schema.html().content(({ get }: { get(path: string): string }) => get('body'))
    const compiled = await compileForm([node(html)], {
      ...options,
      data: { body: '<img src=x onerror="alert(1)"><script>alert(2)</script>' },
    })
    const content = compiled.spec.elements['l.0']?.props.content
    assert.isString(content)
    assert.notInclude(content, 'onerror')
    assert.notInclude(content, '<script')
  })
})

function slugify(value: unknown) {
  return String(value).toLowerCase()
}
