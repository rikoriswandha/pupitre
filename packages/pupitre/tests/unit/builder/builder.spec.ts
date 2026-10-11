import { test } from '@japa/runner'
import {
  action,
  actions,
  definePanel,
  defineWidget,
  defineResource,
  pages,
  schema,
  table,
} from '../../../index.js'
import Post from '../../fixtures/post.js'
import SchemaPost from '../../fixtures/schema_post.js'
// @ts-expect-error the inline validator is deliberately absent from M1
import type { compileFieldValidator } from '../../../src/compiler/vine_compiler.js'

const realistic = () =>
  defineResource(Post)
    .navigation({ group: 'Content', sort: 2, badge: (ctx) => ctx.request.url() })
    .recordTitle('title')
    .form((s) =>
      s.components([
        schema
          .section('Content')
          .columns(2)
          .components([
            s.text('title').required().maxLength(200),
            s.tabs([
              schema
                .tab('Publishing')
                .components([
                  s.select('status').options({ draft: 'Draft', published: 'Published' }),
                ]),
            ]),
            s
              .repeater('items')
              .schema([schema.text('sku').required(), schema.number('qty').min(1)])
              .minItems(1)
              .reorderable()
              .collapsible(),
            s.fileUpload('cover').disk('public').image().maxSize('2mb').accept('image/*'),
            s.richEditor('body').toolbar(['bold', 'link']),
          ]),
      ])
    )
    .table((t) =>
      t
        .defaultSort('createdAt', 'desc')
        .columns([
          table.text('title').searchable().sortable().limit(80),
          table.badge('status').colors({ draft: 'gray', published: 'green' }),
        ])
        .filters([
          table.filter.select('status').options({ draft: 'Draft', published: 'Published' }),
          table.filter.ternary('featured'),
        ])
    )
    .infolist((s) =>
      s.entries([
        schema.textEntry('title').copyable(),
        schema.textEntry('createdAt').dateTime(),
        schema.repeatableEntry('items').schema([schema.textEntry('sku')]),
      ])
    )
    .actions({
      header: [actions.create()],
      row: [
        action('publish')
          .label('Publish')
          .requiresConfirmation()
          .handle(() => {}),
      ],
      bulk: [actions.delete()],
    })
    .pages({
      list: pages.list().tabs({
        all: { label: 'All' },
        draft: { label: 'Draft', where: { status: 'draft' } },
      }),
      create: pages.create().redirectTo('edit'),
      edit: pages.edit(),
      view: pages.view(),
    })

test.group('resource and builder DSL', () => {
  test('serializes a realistic definition deterministically', async ({ assert }) => {
    const output = JSON.parse(realistic().toJSON())
    assert.snapshot(output).match()
    assert.equal(realistic().toJSON(), realistic().toJSON())
  })

  test('hashes closure bodies into serialized definitions', ({ assert }) => {
    const first = defineResource(Post)
      .navigation({ group: 'Content', sort: 1, badge: () => 'draft' })
      .toJSON()
    const second = defineResource(Post)
      .navigation({ group: 'Content', sort: 1, badge: () => 'published' })
      .toJSON()
    assert.notEqual(first, second)
  })

  test('keeps derived resource builders immutable', ({ assert }) => {
    const base = defineResource(Post)
    const first = base.label('Article').slug('articles')
    const second = base.label('News')
    assert.equal(base.toDefinition().slug, 'posts')
    assert.equal(first.toDefinition().pluralLabel, 'Posts')
    assert.equal(second.toDefinition().label, 'News')
    assert.equal(base.toDefinition().label, 'Post')
  })

  test('builds immutable panels and rejects numeric action names', ({ assert }) => {
    const panel = definePanel('admin')
    const branded = panel.brand({ name: 'Example' })
    assert.equal(panel.toDefinition().brand, undefined)
    assert.equal(branded.toDefinition().brand?.name, 'Example')
    assert.throws(() => action('123'))
  })
  test('accepts the lazy discovered widget registry object', ({ assert }) => {
    const widget = defineWidget('monthly-sales').stats(() => [])
    const registry = { monthlySales: () => Promise.resolve({ default: widget }) }
    const panel = definePanel('admin').widgets(registry)
    assert.strictEqual(panel.toDefinition().widgets, registry)
  })

  test('infers model schema fields', () => {
    defineResource(Post).form((s) => {
      s.text('title')
      // @ts-expect-error `nope` is not a Post model attribute
      s.text('nope')
      return s.components([s.text('body')])
    })
    defineResource(SchemaPost).form((s) => {
      s.text('title')
      // @ts-expect-error only declared static $columns are accepted
      s.text('helper')
      return s.components([s.dateTime('publishedAt')])
    })
    const divider = schema.divider()
    // @ts-expect-error layout nodes do not expose field-only repeater modifiers
    void divider.minItems
    const textField = schema.text('title')
    // @ts-expect-error text fields do not expose editor-only modifiers
    void textField.toolbar
    // @ts-expect-error unsupported text icons are not exposed by M1 builders
    void textField.prefixIcon
    // @ts-expect-error checkbox-list bulk toggling is not implemented in M1
    void schema.checkboxList('roles').bulkToggleable
    // @ts-expect-error date display formatting is not implemented in M1
    void schema.date('createdAt').displayFormat
    // @ts-expect-error date week-start configuration is not implemented in M1
    void schema.date('createdAt').weekStartsOn
    // @ts-expect-error date native rendering is not implemented in M1
    void schema.date('createdAt').native
    // @ts-expect-error dateTime native rendering is not implemented in M1
    void schema.dateTime('publishedAt').native
    // @ts-expect-error time native rendering is not implemented in M1
    void schema.time('startsAt').native
    // @ts-expect-error checkbox-list search UI is not implemented in M1
    void schema.checkboxList('roles').searchable
    // @ts-expect-error color format is not implemented in M1
    void schema.color('brand').format
    void (undefined as typeof compileFieldValidator)
  })
  test('omits unsupported schema methods from builder proxies', ({ assert }) => {
    const date = schema.date('createdAt') as unknown as Record<string, unknown>
    const color = schema.color('color') as unknown as Record<string, unknown>
    const checkboxList = schema.checkboxList('roles') as unknown as Record<string, unknown>
    assert.isUndefined(date.native)
    assert.isUndefined(color.format)
    assert.isUndefined(checkboxList.searchable)
  })
})
