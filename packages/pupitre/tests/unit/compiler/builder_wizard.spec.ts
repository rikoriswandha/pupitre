import { test } from '@japa/runner'
import { schema } from '../../../src/builder/schema/schema.js'
import { compileForm } from '../../../src/compiler/schema_compiler.js'
import type { SchemaNodeDefinition } from '../../../src/definition/schema.js'

const compileOptions = {
  locale: 'en',
  timezone: 'UTC',
  form: { method: 'post' as const, url: '/pages', submitLabel: 'Save', dirtyGuard: true },
}
const node = (builder: { toDefinition(): unknown }) =>
  builder.toDefinition() as SchemaNodeDefinition

test.group('Builder and Wizard schema compiler', () => {
  test('compiles typed builder templates and a mounted wizard with deterministic spec', async ({
    assert,
  }) => {
    const form = [
      node(
        schema
          .builder('content')
          .blocks([
            schema
              .block('heading')
              .label('Heading')
              .icon('heading')
              .schema([schema.text('title').required()]),
            schema
              .block('paragraph')
              .label('Paragraph')
              .schema([schema.textarea('body')]),
          ])
          .minItems(1)
          .maxItems(8)
          .reorderable()
          .collapsible()
          .cloneable()
          .addLabel('Add block')
          .blockPickerColumns(2)
      ),
      node(
        schema
          .wizard([
            schema
              .step('Account')
              .description('Your details')
              .icon('user')
              .components([schema.text('email').email().required()]),
            schema.step('Profile').components([schema.text('name').required()]),
          ])
          .startOnStep(2)
          .submitLabel('Finish setup')
      ),
    ]
    const first = await compileForm(form, {
      ...compileOptions,
      data: { content: [{ type: 'heading', data: { title: 'Welcome' } }] },
    })
    const second = await compileForm(form, {
      ...compileOptions,
      data: { content: [{ type: 'heading', data: { title: 'Welcome' } }] },
    })
    assert.snapshot(first.spec).match()
    assert.deepEqual(first.spec, second.spec)
    assert.equal(first.spec.elements['f.content']?.type, 'Builder')
    assert.equal(first.spec.elements['l.0']?.type, 'Wizard')
    const wizardSteps = first.spec.elements['l.0']?.props.steps as
      { description?: string; icon?: string }[] | undefined
    assert.deepEqual(
      wizardSteps?.map(({ description, icon }) => ({ description, icon })),
      [
        { description: 'Your details', icon: 'user' },
        { description: undefined, icon: undefined },
      ]
    )
    assert.equal((first.state.data as { content: { _key: string }[] }).content[0]?._key, 'b0')
    assert.equal(
      (first.state.ui as { wizard: Record<string, { step: number }> }).wizard['l.0']?.step,
      1
    )
  })
})
