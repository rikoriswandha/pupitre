import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'
import { findUploadField, isUploadMimeAllowed } from '../../../src/storage/upload_validation.js'

test.group('Builder validated output', () => {
  test('persists sanitized, dehydrated and timezone-normalized output instead of raw block values', async ({
    assert,
  }) => {
    const validator = compileValidator([
      schema
        .builder('content')
        .blocks([
          schema.block('hero').schema([
            schema.richEditor('body'),
            schema.text('disabled').disabled(true),
            schema
              .text('hidden')
              .hidden(() => true)
              .dehydratedWhenHidden(false),
            schema.text('omitted').dehydrated(false),
            schema.text('title').dehydrate((value) => String(value).trim()),
            schema.dateTime('at'),
          ]),
        ])
        .toDefinition(),
    ])
    const output = await validator.validate(
      {
        content: [
          {
            type: 'hero',
            data: {
              body: '<p>Safe</p><script>alert(1)</script>',
              disabled: 'forged',
              hidden: 'forged',
              omitted: 'forged',
              unknown: 'forged',
              title: ' Trimmed ',
              at: '2026-01-15T12:00:00',
            },
          },
        ],
      },
      { timezone: 'Asia/Jakarta' }
    )
    const blocks = output.content as { data: Record<string, unknown> }[]
    assert.equal(blocks[0].data.body, '<p>Safe</p>')
    assert.equal(blocks[0].data.title, 'Trimmed')
    for (const key of ['disabled', 'hidden', 'omitted', 'unknown'])
      assert.isFalse(Object.hasOwn(blocks[0].data, key))
    const at = blocks[0].data.at
    assert.isTrue(DateTime.isDateTime(at))
    if (!DateTime.isDateTime(at)) throw new Error('Expected normalized DateTime')
    assert.equal(at.toISO(), '2026-01-15T05:00:00.000Z')
  })

  test('propagates option and visibility callback failures rather than accepting a block', async ({
    assert,
  }) => {
    const failure = new Error('host validation backend failed')
    const validators = [
      schema.select('selection').options(async () => {
        throw failure
      }),
      schema
        .text('selection')
        .hidden(() => {
          throw failure
        })
        .dehydratedWhenHidden(false),
    ]
    for (const field of validators) {
      const validator = compileValidator([
        schema
          .builder('content')
          .blocks([schema.block('hero').schema([field])])
          .toDefinition(),
      ])
      try {
        await validator.validate(
          { content: [{ type: 'hero', data: { selection: 'forged' } }] },
          { timezone: 'UTC' }
        )
        assert.fail('Expected host validation error')
      } catch (error) {
        assert.strictEqual(error, failure)
      }
    }
  })

  test('matches uploads only by schema path and preserves colliding top-level restrictions', ({
    assert,
  }) => {
    const form = [
      schema
        .builder('content')
        .blocks([schema.block('hero').schema([schema.fileUpload('image')])])
        .toDefinition(),
      schema.fileUpload('image').image().maxSize('1kb').toDefinition(),
    ]
    const top = findUploadField(form, 'image')
    const nested = findUploadField(form, 'content.hero.data.image')
    assert.strictEqual(top, form[1])
    assert.isDefined(nested)
    if (!top || !nested) throw new Error('Expected both upload fields')
    assert.isFalse(isUploadMimeAllowed(top, 'application/pdf', 'pdf'))
    assert.isTrue(isUploadMimeAllowed(nested, 'application/pdf', 'pdf'))
    assert.isUndefined(findUploadField([form[0]], 'image'))
  })
})
