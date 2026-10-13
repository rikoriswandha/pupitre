import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import {
  mentionProvider,
  richBlock,
  renderRichContent,
  schema,
  compileValidator,
} from '../../../index.js'
import { compileForm, compileInfolist } from '../../../src/compiler/schema_compiler.js'
import { sanitizeHtml } from '../../../src/sanitize.js'

const callout = richBlock('callout')
  .label('Callout')
  .schema((fields) => [
    fields.text('title').required(),
    fields.select('tone').options({ info: 'Info', warning: 'Warning' }).required(),
  ])
  .toHtml(({ config }) => `<strong>${String(config.title)}</strong>`)
const blockHtml = (config: unknown, id = 'callout') =>
  `<div data-type="customBlock" data-id="${id}" data-config='${JSON.stringify(config)}'></div>`
const mentionHtml = (id: string, label = 'Alice', char = '@') =>
  `<span data-type="mention" data-id="${id}" data-label="${label}" data-char="${char}">@${label}</span>`

test.group('rich content parity', () => {
  test('sanitizer preserves supported nodes without forged attributes or scripts', ({ assert }) => {
    const html = sanitizeHtml(
      `<span data-type="mergeTag" data-id="name" data-config="forged" onclick="attack()">{{ name }}</span>${mentionHtml('1')}${blockHtml({ title: 'Safe', tone: 'info' })}<span data-type="evil" data-id="x" data-char="@">evil</span><script>attack()</script>`
    )
    assert.include(html, 'data-type="mergeTag" data-id="name"')
    assert.include(html, 'data-type="mention"')
    assert.include(html, 'data-type="customBlock"')
    assert.notInclude(html, 'onclick')
    assert.notInclude(html, 'forged')
    assert.notInclude(html, 'data-type="evil"')
    assert.notInclude(html, 'script')
    assert.notInclude(sanitizeHtml(blockHtml(['bad'])), 'data-type')
    assert.notInclude(
      sanitizeHtml('<div data-type="customBlock" data-id="callout" data-config="not-json"></div>'),
      'data-type'
    )
  })
  test('rendering escapes merge values and block output, drops unknown blocks, and sanitizes raw opt-in', ({
    assert,
  }) => {
    const html = `<p>Hello <span data-type="mergeTag" data-id="name">{{ name }}</span></p>${blockHtml({ title: 'Safe', tone: 'info' })}${blockHtml({}, 'unknown')}`
    const rendered = renderRichContent(html, {
      mergeTags: { name: '<img src=x onerror=attack()>' },
      blocks: [callout],
    })
    assert.include(rendered, '&lt;img src=x onerror=attack()&gt;')
    assert.include(rendered, '&lt;strong&gt;Safe&lt;/strong&gt;')
    assert.notInclude(rendered, 'data-type')
    assert.notInclude(rendered, 'unknown')
    const raw = callout
      .rawHtml()
      .toHtml(
        () => '<strong>Safe</strong><script>attack()</script><a href="javascript:attack()">x</a>'
      )
    assert.equal(
      renderRichContent(blockHtml({ title: 'Safe', tone: 'info' }), { blocks: [raw] }),
      '<strong>Safe</strong><a>x</a>'
    )
    assert.include(
      renderRichContent('<span data-type="mergeTag" data-id="today">{{ today }}</span>', {
        mergeTags: { today: 42 },
      }),
      '42'
    )
    assert.equal(
      renderRichContent(
        '<span data-type="mergeTag" data-id="name"><strong>forged</strong><span data-type="mergeTag" data-id="today">nested</span></span><span data-type="mergeTag" data-id="today">today</span>',
        { mergeTags: { name: 'Alice', today: 42 } }
      ),
      'Alice42'
    )
  })
  test('immutable provider and block builders retain closures until compilation', ({ assert }) => {
    const empty = mentionProvider('@')
    const options = empty.options([{ id: 1, label: 'Alice' }])
    assert.isUndefined(empty.toDefinition().options)
    assert.equal(options.toDefinition().options?.[0]?.label, 'Alice')
    assert.isUndefined(callout.toDefinition().rawHtml)
    assert.isTrue(callout.rawHtml().toDefinition().rawHtml)
  })
  test('save validation canonicalizes mentions and strips forged static/search ids and unknown providers', async ({
    assert,
  }) => {
    const ctx = { tenantId: 1 } as unknown as HttpContext
    const validator = compileValidator([
      schema
        .richEditor('body')
        .mentions([
          mentionProvider('@').options([{ id: 1, label: 'Alice' }]),
          mentionProvider('#').search(async (query, context) =>
            context === ctx && query === 'Project' ? [{ id: 'p1', label: 'Project' }] : []
          ),
        ])
        .toDefinition(),
    ])
    const result = await validator.validate(
      {
        body: `${mentionHtml('1', 'Forged label')}${mentionHtml('2')}${mentionHtml('p1', 'Project', '#')}${mentionHtml('p2', 'Project', '#')}${mentionHtml('1', 'Alice', '!')}`,
      },
      { ctx, timezone: 'UTC' }
    )
    assert.equal(String(result.body).match(/data-type="mention"/g)?.length, 2)
    assert.include(String(result.body), 'data-id="1" data-label="Alice"')
    assert.include(String(result.body), 'data-id="p1"')
    assert.notInclude(String(result.body), 'data-id="2"')
    assert.notInclude(String(result.body), 'data-id="p2"')
    assert.notInclude(String(result.body), 'data-char="!"')
  })
  test('save validation rejects invalid block config with nested field errors and removes unknown config keys', async ({
    assert,
  }) => {
    const validator = compileValidator([
      schema.richEditor('body').customBlocks([callout]).toDefinition(),
    ])
    try {
      await validator.validate({ body: blockHtml({ tone: 'forged' }) }, { timezone: 'UTC' })
      assert.fail('Expected block validation error')
    } catch (error) {
      const failure = error as { code: string; messages: { field: string }[] }
      assert.equal(failure.code, 'E_VALIDATION_ERROR')
      assert.includeMembers(
        failure.messages.map((issue) => issue.field),
        ['body.blocks.0.title', 'body.blocks.0.tone']
      )
    }
    const valid = await validator.validate(
      { body: blockHtml({ title: 'Safe', tone: 'info', forged: true }) },
      { timezone: 'UTC' }
    )
    assert.notInclude(String(valid.body), 'forged')
    await assert.rejects(() =>
      validator.validate(
        { body: '<div data-type="customBlock" data-id="callout" data-config="broken"></div>' },
        { timezone: 'UTC' }
      )
    )
  })
  test('compiler sends serializable block forms and rich infolist rendering', async ({
    assert,
  }) => {
    const field = schema
      .richEditor('body')
      .mergeTags({ name: 'Name' })
      .customBlocks([callout])
      .mentions([mentionProvider('@').options([{ id: 1, label: 'Alice' }])])
    const form = await compileForm([field.toDefinition()], {
      locale: 'en',
      timezone: 'UTC',
      record: { title: 'Outer post title' },
      form: { url: '/save', method: 'post', submitLabel: 'Save', dirtyGuard: false },
    })
    const encoded = JSON.stringify(form.spec)
    assert.include(encoded, 'customBlocks')
    assert.include(encoded, 'Callout')
    assert.notInclude(encoded, 'toHtml')
    const blocks = form.spec.elements['f.body'].props.customBlocks as {
      state: { data: Record<string, unknown> }
    }[]
    assert.notEqual(blocks[0].state.data.title, 'Outer post title')
    const info = await compileInfolist(
      [
        schema
          .textEntry('body')
          .richContent({ mergeTags: { name: '<Alice>' }, blocks: [callout] })
          .toDefinition(),
      ],
      {
        locale: 'en',
        timezone: 'UTC',
        record: { body: '<span data-type="mergeTag" data-id="name">{{ name }}</span>' },
      }
    )
    assert.equal(info.spec.elements['f.body'].props.html, true)
    assert.include(JSON.stringify(info.spec), '&lt;Alice&gt;')
  })
})
