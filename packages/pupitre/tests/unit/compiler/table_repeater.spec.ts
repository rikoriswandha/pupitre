import { test } from '@japa/runner'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileForm } from '../../../src/compiler/schema_compiler.js'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'
import { repeaterDescriptor } from '../../../catalog/wire.js'

const options = {
  locale: 'en',
  timezone: 'UTC',
  form: { method: 'post' as const, url: '/orders', submitLabel: 'Create', dirtyGuard: true },
}

test.group('Table repeater', () => {
  test('emits positional columns, bindings, defaults and ignores item labels in table mode', async ({
    assert,
  }) => {
    const column = schema.tableColumn('SKU')
    const nodes = [
      schema
        .repeater('items')
        .schema([schema.text('sku').required(), schema.number('qty').default(1).min(1)])
        .table([column.width('8rem').markAsRequired(), schema.tableColumn('Qty').alignment('end')])
        .defaultItems(2)
        .reorderable()
        .cloneable()
        .itemLabel(({ get }) => String(get('sku')).toUpperCase())
        .toDefinition(),
    ]
    const result = await compileForm(nodes, options)
    const descriptor = repeaterDescriptor.parse(result.spec.elements['f.items'].props.descriptor)
    assert.deepEqual(descriptor.table, [
      { label: 'SKU', width: '8rem', required: true },
      { label: 'Qty', alignment: 'end' },
    ])
    assert.deepEqual(column.toDefinition(), { label: 'SKU' })
    assert.deepEqual(result.spec.elements['f.items.sku'].props.value, { $bindItem: 'sku' })
    assert.notProperty(result.spec.elements['f.items.sku'].props, 'error')
    assert.notProperty(result.spec.elements['f.items.item'].props, 'itemLabel')
    assert.lengthOf(descriptor.defaultItems ?? [], 2)
    assert.isTrue(descriptor.reorderable)
    assert.isTrue(descriptor.cloneable)
  })

  test('derives headers and required marks from field labels without explicit columns', async ({
    assert,
  }) => {
    const result = await compileForm(
      [
        schema
          .repeater('items')
          .table()
          .schema([schema.text('sku').label('Stock code').required(), schema.number('qty')])
          .toDefinition(),
      ],
      options
    )
    const descriptor = repeaterDescriptor.parse(result.spec.elements['f.items'].props.descriptor)
    assert.deepEqual(descriptor.table, [
      { label: 'Stock code', required: true },
      { label: 'Qty', required: false },
    ])
  })

  test('rejects closure labels in implicit columns instead of silently replacing them', async ({
    assert,
  }) => {
    const field = schema.text('sku').label(() => 'Stock code')
    await assert.rejects(
      () => compileForm([schema.repeater('items').table().schema([field]).toDefinition()], options),
      /closure-valued field labels; provide explicit table column labels/
    )
    const result = await compileForm(
      [
        schema
          .repeater('items')
          .table([schema.tableColumn('Stock code')])
          .schema([field])
          .toDefinition(),
      ],
      options
    )
    assert.equal(result.spec.elements['f.items.sku'].props.label, 'Stock code')
  })

  test('rejects mismatched columns in either builder order and deferred schema compilation', async ({
    assert,
  }) => {
    assert.throws(
      () =>
        schema
          .repeater('items')
          .schema([schema.text('sku')])
          .table([schema.tableColumn('SKU'), schema.tableColumn('Qty')]),
      /1 schema fields but 2 columns/
    )
    assert.throws(
      () =>
        schema
          .repeater('items')
          .table([schema.tableColumn('SKU')])
          .schema([schema.text('sku'), schema.number('qty')]),
      /2 schema fields but 1 columns/
    )
    await assert.rejects(
      () =>
        compileForm(
          [
            schema
              .repeater('items')
              .schema((s) => [s.text('sku')])
              .table([schema.tableColumn('SKU'), schema.tableColumn('Qty')])
              .toDefinition(),
          ],
          options
        ),
      /1 schema fields but 2 columns/
    )
  })

  test('keeps Vine error paths tied to the invalid row and strips internal keys', async ({
    assert,
  }) => {
    const nodes = [
      schema
        .repeater('items')
        .schema([schema.text('sku').required(), schema.number('qty').min(1)])
        .table()
        .toDefinition(),
    ]
    const validator = compileValidator(nodes)
    let messages: { field: string }[] = []
    try {
      await validator.validate({ items: [{ sku: 'A', qty: 1 }, { qty: 0 }] }, { timezone: 'UTC' })
      assert.fail('Invalid table cells must fail server validation')
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'messages' in error &&
        Array.isArray(error.messages)
      )
        messages = error.messages
      else throw error
    }
    assert.sameMembers(
      messages.map((message) => message.field),
      ['items.1.sku', 'items.1.qty']
    )
    assert.deepEqual(
      await validator.validate({ items: [{ _key: 'a', sku: 'A', qty: 1 }] }, { timezone: 'UTC' }),
      {
        items: [{ sku: 'A', qty: 1 }],
      }
    )
  })

  test('preserves repeater disabled/read-only and visible conditions in compiled table mode', async ({
    assert,
  }) => {
    const result = await compileForm(
      [
        schema
          .repeater('items')
          .schema([schema.text('sku')])
          .table()
          .disabled(({ get }) => get('locked') === true)
          .readOnly()
          .hidden(({ get }) => get('locked') === true)
          .toDefinition(),
      ],
      options
    )
    assert.deepEqual(result.spec.elements['f.items'].props.disabled, {
      $cond: { $state: '/data/locked', eq: true },
      $then: true,
      $else: false,
    })
    assert.isTrue(result.spec.elements['f.items'].props.readOnly)
    assert.deepEqual(result.spec.elements['f.items'].visible, {
      $state: '/data/locked',
      eq: true,
      not: true,
    })
  })
  test('retains async option fields, item live bindings and server watch paths in table mode', async ({
    assert,
  }) => {
    const nodes = [
      schema
        .repeater('items')
        .schema([
          schema.select('sku').options(async () => [{ value: 'A', label: 'Product A' }]),
          schema
            .number('qty')
            .live({ server: true })
            .afterStateUpdated(({ get, set }) => {
              set('total', Number(get('qty')) * 2)
            }),
          schema.number('total').readOnly(),
        ])
        .table()
        .toDefinition(),
    ]
    const result = await compileForm(nodes, { ...options, resourceSlug: 'orders' })
    assert.deepEqual(result.spec.elements['f.items.sku'].props.value, { $bindItem: 'sku' })
    assert.deepEqual(result.spec.elements['f.items.qty'].watch, {
      '/data/items/qty': [
        {
          action: 'evaluate',
          params: {
            url: '/_pupitre/evaluate',
            resource: 'orders',
            field: 'items.*.qty',
            debounce: 0,
          },
        },
      ],
    })
    assert.isTrue(result.spec.elements['f.items.total'].props.readOnly)
  })
})
