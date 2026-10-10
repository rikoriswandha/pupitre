import { test } from '@japa/runner'
import { getComponentDefinition, schema } from '../../../src/builder/schema/schema.js'
import type { SchemaNodeDefinition } from '../../../src/definition/schema.js'
import {
  findUploadField,
  isUploadMimeAllowed,
  parseMaxSize,
} from '../../../src/storage/upload_validation.js'

test.group('upload validation helpers', () => {
  test('parses bytes and binary kilobyte and megabyte sizes', ({ assert }) => {
    assert.equal(parseMaxSize(512), 512)
    assert.equal(parseMaxSize(0), 0)
    assert.equal(parseMaxSize('500kb'), 512_000)
    assert.equal(parseMaxSize('2mb'), 2_097_152)
    assert.equal(parseMaxSize('1.5mb'), 1_572_864)
  })

  test('returns undefined for unsupported sizes', ({ assert }) => {
    assert.isUndefined(parseMaxSize(undefined))
    assert.isUndefined(parseMaxSize('2gb'))
    assert.isUndefined(parseMaxSize('unlimited'))
  })

  test('finds upload fields inside layouts and repeater callbacks', ({ assert }) => {
    const nodes: SchemaNodeDefinition[] = [
      getComponentDefinition(
        schema
          .section('Images')
          .components([schema.repeater('items').schema((s) => [s.fileUpload('photo').image()])])
      ),
    ]
    const field = findUploadField(nodes, 'photo')
    assert.isUndefined(findUploadField(nodes, 'missing'))
    assert.isDefined(field)
    assert.equal(field?.kind, 'fileUpload')
    assert.isTrue(field?.kind === 'fileUpload' && field.image === true)
  })

  test('uses sniffed mime and extension against image and accept restrictions', ({ assert }) => {
    const imageField = getComponentDefinition(schema.fileUpload('cover').image())
    const acceptedField = getComponentDefinition(
      schema.fileUpload('cover').accept('.png, image/jpeg')
    )
    const editorField = getComponentDefinition(schema.richEditor('body'))

    assert.isTrue(isUploadMimeAllowed(imageField, 'image/png', 'png'))
    assert.isFalse(isUploadMimeAllowed(imageField, 'application/x-msdownload', 'exe'))
    assert.isFalse(isUploadMimeAllowed(acceptedField, 'application/x-msdownload', 'exe'))
    assert.isTrue(isUploadMimeAllowed(acceptedField, 'image/png', 'png'))
    assert.isTrue(isUploadMimeAllowed(editorField, 'image/jpeg', 'jpg'))
    assert.isFalse(isUploadMimeAllowed(editorField, 'application/x-msdownload', 'exe'))
  })
})
