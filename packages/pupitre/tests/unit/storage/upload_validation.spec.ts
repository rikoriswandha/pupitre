import { test } from '@japa/runner'
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getComponentDefinition, schema } from '../../../src/builder/schema/schema.js'
import type { SchemaNodeDefinition } from '../../../src/definition/schema.js'
import {
  findUploadField,
  isUploadMimeAllowed,
  parseMaxSize,
  readUploadBytes,
  isPassiveImageMime,
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
    const field = findUploadField(nodes, 'items.photo')
    assert.isUndefined(findUploadField(nodes, 'photo'))
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

  test('rejects active content even when the configured accept explicitly allows it', ({
    assert,
  }) => {
    const unrestricted = getComponentDefinition(schema.fileUpload('file'))
    const accepted = getComponentDefinition(
      schema.fileUpload('file').accept('image/svg+xml,text/html')
    )
    for (const field of [unrestricted, accepted]) {
      assert.isFalse(isUploadMimeAllowed(field, 'image/svg+xml', 'svg'))
      assert.isFalse(isUploadMimeAllowed(field, 'text/html', 'html'))
      assert.isFalse(isUploadMimeAllowed(field, 'application/xhtml+xml', 'xhtml'))
    }
    assert.isFalse(isPassiveImageMime('image/svg+xml'))
    assert.isTrue(isPassiveImageMime('image/png'))
  })

  test('bounds buffering by the actual tempfile size, not multipart metadata', async ({
    assert,
  }) => {
    const directory = await mkdtemp(join(tmpdir(), 'pupitre-upload-size-'))
    const path = join(directory, 'file')
    try {
      await writeFile(path, Buffer.from('safe'))
      const bytes = await readUploadBytes(path, 4)
      assert.equal(bytes.toString(), 'safe')
      await assert.rejects(() => readUploadBytes(path, 3), /exceeds the maximum size/)
      const sparse = await open(path, 'w')
      try {
        await sparse.truncate(1024 * 1024 * 1024)
      } finally {
        await sparse.close()
      }
      await assert.rejects(
        () => readUploadBytes(path, 10 * 1024 * 1024),
        /exceeds the maximum size/
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
