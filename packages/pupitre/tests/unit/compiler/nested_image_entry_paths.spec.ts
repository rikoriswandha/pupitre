import { test } from '@japa/runner'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileInfolist } from '../../../src/compiler/schema_compiler.js'
import { findUploadField } from '../../../src/storage/upload_validation.js'

test.group('Nested image entry schema paths', () => {
  test('resolves repeater images using their private disk and full path at every nesting depth', async ({
    assert,
  }) => {
    const form = [
      schema
        .repeater('gallery')
        .schema([
          schema.fileUpload('image').disk('private-media').visibility('private'),
          schema
            .repeater('children')
            .schema([schema.fileUpload('image').disk('nested-media').visibility('private')]),
        ])
        .toDefinition(),
    ]
    const infolist = [
      schema
        .repeatableEntry('gallery')
        .schema([
          schema.imageEntry('image'),
          schema.repeatableEntry('children').schema([schema.imageEntry('image')]),
        ])
        .toDefinition(),
    ]
    const resolved: string[] = []
    const compiled = await compileInfolist(infolist, {
      locale: 'en',
      timezone: 'UTC',
      record: { gallery: [{ image: 'first.png', children: [{ image: 'nested.png' }] }] },
      resolveFileUrl: async (key, field) => {
        const upload = findUploadField(form, field.name)
        if (!upload || upload.kind !== 'fileUpload')
          throw new Error('Missing full-path upload field')
        resolved.push(field.name)
        assert.equal(upload.visibility, 'private')
        return `https://signed.test/${upload.disk}/${key}?signature=private`
      },
    })
    assert.deepEqual(resolved.sort(), ['gallery.children.image', 'gallery.image'])
    assert.deepEqual(compiled.spec.elements['f.gallery'].props.value, [
      {
        image: 'https://signed.test/private-media/first.png?signature=private',
        children: [{ image: 'https://signed.test/nested-media/nested.png?signature=private' }],
      },
    ])
  })
})
