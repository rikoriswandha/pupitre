import { test } from '@japa/runner'
import { fileUploadDescriptor } from '../../../catalog/index.js'
import { schema } from '../../../index.js'
import { compileForm, compileInfolist } from '../../../src/compiler/schema_compiler.js'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'
import type {
  FieldDefinitionUnion,
  MarkdownEditorFieldDefinition,
  SchemaNodeDefinition,
} from '../../../src/definition/schema.js'

const node = (builder: { toDefinition(): unknown }) =>
  builder.toDefinition() as SchemaNodeDefinition
const options = {
  locale: 'en',
  timezone: 'UTC',
  form: { method: 'post' as const, url: '/posts', submitLabel: 'Create', dirtyGuard: true },
}

test.group('editor parity', () => {
  test('compiles markdown/code editors and the image crop descriptor', async ({ assert }) => {
    const markdownEditor = schema
      .markdownEditor('summary')
      .toolbar(['bold', 'italic'])
      .fileAttachments({ disk: 'uploads', directory: 'posts/summary' })
    const markdownDefinition = markdownEditor.toDefinition() as MarkdownEditorFieldDefinition
    assert.equal(markdownDefinition.fileAttachmentsDisk, 'uploads')
    assert.equal(markdownDefinition.fileAttachmentsDirectory, 'posts/summary')
    const compiled = await compileForm(
      [
        node(markdownEditor),
        node(schema.codeEditor('snippet').language('typescript').lineNumbers().minHeight(240)),
        node(
          schema
            .fileUpload('cover')
            .image()
            .imageEditor()
            .imageEditorAspectRatios(['16:9', '4:3', '1:1', null])
        ),
      ],
      { ...options, uploadUrls: { upload: '/_pupitre/upload', delete: '/_pupitre/upload' } }
    )
    assert.snapshot(compiled.spec).match()
    assert.equal(compiled.spec.elements['f.summary']?.type, 'MarkdownEditor')
    assert.equal(compiled.spec.elements['f.summary']?.props.uploadUrl, '/_pupitre/upload')
    assert.equal(compiled.spec.elements['f.snippet']?.type, 'CodeEditor')
    const descriptor = fileUploadDescriptor.parse(
      compiled.spec.elements['f.cover']?.props.descriptor
    )
    assert.isTrue(descriptor.imageEditor)
  })

  test('renders Markdown entries on the server and sanitizes HTML, event handlers and unsafe links', async ({
    assert,
  }) => {
    const view = await compileInfolist([node(schema.textEntry('body').markdown())], {
      locale: 'en',
      timezone: 'UTC',
      record: {
        body: '## Safe\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[bad](javascript:alert(3))',
      },
    })
    const element = view.spec.elements['f.body']
    const rendered = element?.props.value
    assert.isString(rendered)
    assert.include(rendered, '<h2>Safe</h2>')
    assert.notInclude(rendered, '<script')
    assert.notInclude(rendered, 'onerror')
    assert.notInclude(rendered, 'javascript:')
    assert.equal(element?.props.markdown, true)
  })

  test('code editor uses the standard Vine string rules', async ({ assert }) => {
    const definition = node(schema.codeEditor('snippet').required()) as FieldDefinitionUnion
    const validator = compileValidator([definition])
    assert.deepEqual(await validator.validate({ snippet: '{"valid":true}' }, options), {
      snippet: '{"valid":true}',
    })
    await assert.rejects(() => validator.validate({}, options))
  })
})
