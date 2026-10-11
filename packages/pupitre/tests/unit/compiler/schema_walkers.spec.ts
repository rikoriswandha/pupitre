import { test } from '@japa/runner'
import { compileValidator } from '../../../src/compiler/vine_compiler.js'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileForm } from '../../../src/compiler/schema_compiler.js'
import { findUploadField } from '../../../src/storage/upload_validation.js'
import { resourceAttributes } from '../../../src/http/repeater_relationships.js'
import { walkSchema } from '../../../src/definition/walk.js'
import type { SchemaNodeDefinition } from '../../../src/definition/schema.js'

const node = (builder: { toDefinition(): unknown }) =>
  builder.toDefinition() as SchemaNodeDefinition
const options = {
  locale: 'en',
  timezone: 'UTC',
  form: { method: 'post' as const, url: '/schema', submitLabel: 'Save', dirtyGuard: true },
}

test.group('Schema walkers and nested item bindings', () => {
  test('walks wizard steps, builder block schemas, and repeater schemas', ({ assert }) => {
    const nodes = [
      node(schema.wizard([schema.step('Details').components([schema.fileUpload('avatar')])])),
      node(
        schema
          .builder('content')
          .blocks([schema.block('image').schema([schema.markdownEditor('caption')])])
      ),
      node(schema.repeater('items').schema([schema.select('category')])),
    ]
    const found: string[] = []
    walkSchema(nodes, (field, path) => {
      if ('name' in field && field.name) found.push(`${field.kind}:${path}`)
    })
    assert.include(found, 'fileUpload:avatar')
    assert.include(found, 'markdownEditor:content.image.data.caption')
    assert.include(found, 'select:items.category')
    assert.equal(findUploadField(nodes, 'avatar')?.kind, 'fileUpload')
    assert.equal(findUploadField(nodes, 'content.image.data.caption')?.kind, 'markdownEditor')
  })
  test('finds relationship repeaters nested in wizard and builder schemas', ({ assert }) => {
    const nodes = [
      node(
        schema.wizard([
          schema.step('Details').components([schema.repeater('wizardLinks').relationship('links')]),
        ])
      ),
      node(
        schema
          .builder('content')
          .blocks([
            schema.block('related').schema([schema.repeater('blockLinks').relationship('links')]),
          ])
      ),
    ]
    const attributes = resourceAttributes(nodes, {
      title: 'Post',
      wizardLinks: [{ label: 'wizard' }],
      blockLinks: [{ label: 'block' }],
    })
    assert.deepEqual(attributes, { title: 'Post' })
  })

  test('binds repeater and builder item fields to their explicit item scope', async ({
    assert,
  }) => {
    const inBuilderBlock = [
      node(
        schema
          .builder('content')
          .blocks([
            schema
              .block('gallery')
              .schema([schema.repeater('images').schema([schema.text('url')])]),
          ])
      ),
    ]
    const blockCompiled = await compileForm(inBuilderBlock, options)
    assert.deepEqual(blockCompiled.spec.elements['f.content.gallery.data.images']?.props.value, {
      $bindItem: 'data/images',
    })
    assert.deepEqual(
      blockCompiled.spec.elements['f.content.gallery.data.images']?.repeat?.statePath,
      { $item: 'data/images' }
    )

    const inRepeater = [
      node(
        schema
          .repeater('sections')
          .schema([
            schema.repeater('dataSources').schema([schema.text('label')]),
            schema
              .builder('content')
              .blocks([schema.block('heading').schema([schema.text('title')])]),
          ])
      ),
    ]
    const repeaterCompiled = await compileForm(inRepeater, options)
    assert.deepEqual(repeaterCompiled.spec.elements['f.sections.dataSources.label']?.props.value, {
      $bindItem: 'label',
    })
    assert.deepEqual(repeaterCompiled.spec.elements['f.sections.content']?.props.value, {
      $bindItem: 'content',
    })
    assert.deepEqual(
      repeaterCompiled.spec.elements['f.sections.content.heading.data.title']?.props.value,
      { $bindItem: 'data/title' }
    )
  })
  test('applies builder field rules, metadata, visibility, disabled state, and defaults', async ({
    assert,
  }) => {
    const builder = node(
      schema
        .builder('content')
        .label('Content')
        .helperText('Compose content')
        .hint('Use a heading')
        .required()
        .disabled(true)
        .columnSpan(2)
        .visible(() => true)
        .default([{ type: 'heading', data: { title: 'Default title' } }])
        .blocks([schema.block('heading').schema([schema.text('title')])])
    )
    const compiled = await compileForm([builder], options)
    const props = compiled.spec.elements['f.content']?.props
    assert.equal(props?.label, 'Content')
    assert.equal(props?.helperText, 'Compose content')
    assert.equal(props?.hint, 'Use a heading')
    assert.equal(props?.required, true)
    assert.equal(props?.disabled, true)
    assert.equal(props?.columnSpan, 2)
    const defaultContent = (compiled.state.data as Record<string, unknown>).content as
      { data?: { title?: string } }[] | undefined
    assert.equal(defaultContent?.[0]?.data?.title, 'Default title')
    assert.isDefined(compiled.spec.elements['f.content']?.visible)

    const requiredBuilder = node(
      schema
        .builder('requiredContent')
        .required()
        .blocks([schema.block('heading').schema([schema.text('title')])])
    )
    let rejected = false
    try {
      await compileValidator([requiredBuilder]).validate({}, { timezone: 'UTC' })
    } catch {
      rejected = true
    }
    assert.isTrue(rejected, 'required builder input must be rejected')
  })
})
