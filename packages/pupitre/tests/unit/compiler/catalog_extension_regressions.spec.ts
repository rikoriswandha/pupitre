import { test } from '@japa/runner'
import { z } from 'zod'
import vine from '@vinejs/vine'
import { defineCatalogExtension } from '../../../catalog/index.js'
import {
  action,
  compileValidator,
  defineColumn,
  defineEntry,
  defineField,
  schema,
} from '../../../index.js'
import { compileForm, compileInfolist } from '../../../src/compiler/schema_compiler.js'
import { compileActionForm } from '../../../src/compiler/action_compiler.js'
import { compileTable } from '../../../src/compiler/table_compiler.js'
import { Table } from '../../../src/builder/table/table.js'

const options = {
  locale: 'en',
  timezone: 'UTC',
  form: { method: 'post' as const, url: '/scores', submitLabel: 'Save', dirtyGuard: true },
}
const extension = defineCatalogExtension({
  name: 'transformed-props',
  components: {
    TransformedField: {
      kind: 'field',
      props: z.object({ max: z.string().transform(Number).pipe(z.number().positive()) }),
      description: '',
    },
    TransformedColumn: {
      kind: 'column',
      props: z.object({ max: z.string().transform(Number) }),
      description: '',
    },
    TransformedEntry: {
      kind: 'entry',
      props: z.object({
        max: z.preprocess(
          (value) => (typeof value === 'string' ? Number(value) : Number.NaN),
          z.number()
        ),
      }),
      description: '',
    },
  },
})
const methods = { maximum: (max: string) => ({ max }) }
const score = defineField('sharedScore', {
  extension,
  component: 'TransformedField',
  methods,
  validate: (props) => vine.number().max(props.max),
})
const column = defineColumn('sharedScore', { extension, component: 'TransformedColumn', methods })
const entry = defineEntry('sharedScore', { extension, component: 'TransformedEntry', methods })

test('transformed props compile and validate in fields, actions, repeaters, entries and columns', async ({
  assert,
}) => {
  const field = score('score').maximum('7').required().label('Score').toDefinition()
  const form = await compileForm(
    [
      field,
      schema
        .repeater('items')
        .schema([score('score').maximum('4').required()])
        .toDefinition(),
    ],
    options
  )
  assert.equal(form.spec.elements['f.score'].props.max, 7)
  assert.equal(form.spec.elements['f.items.score'].props.max, 4)
  const validator = compileValidator([field])
  assert.deepEqual(await validator.validate({ score: 6 }, options), { score: 6 })
  await assert.rejects(() => validator.validate({ score: 8 }, options), /Validation failure/)
  const modal = await compileActionForm(
    action('transform').form([score('score').maximum('7')]).definition,
    { ...options, url: '/score' }
  )
  assert.equal(modal.spec.elements['f.score'].props.max, 7)
  assert.deepEqual(modal.catalogExtensions, [
    { name: extension.name, components: ['TransformedField'] },
  ])
  const infolist = await compileInfolist([entry('score').maximum('7').toDefinition()], {
    ...options,
    record: { score: 3 },
  })
  assert.equal(infolist.spec.elements['f.score'].props.max, 7)
  const definition = new Table({
    columns: [],
    filters: [],
    filtersLayout: 'dropdown',
    searchDebounce: 300,
    paginated: [10],
    striped: false,
  })
    .columns([column('score').maximum('7')])
    .toDefinition()
  const table = await compileTable(definition, {
    url: '/scores',
    id: 'scores',
    bulkActions: [],
    compileFilterForm: async () => form.spec,
  })
  assert.equal(table.columns[0].props?.max, 7)
})

test('independent extensions can share a kind while retaining distinct validation and rendering', async ({
  assert,
}) => {
  const other = defineCatalogExtension({
    name: 'independent-score',
    components: {
      IndependentScore: {
        kind: 'field',
        props: z.object({ max: z.number().default(2) }),
        description: '',
      },
    },
  })
  const independent = defineField('sharedScore', {
    extension: other,
    component: 'IndependentScore',
    validate: (props) => vine.number().max(props.max),
  })
  const fields = [
    score('first').maximum('7').required().toDefinition(),
    independent('second').required().toDefinition(),
  ]
  const form = await compileForm(fields, options)
  assert.equal(form.spec.elements['f.first'].type, 'TransformedField')
  assert.equal(form.spec.elements['f.second'].type, 'IndependentScore')
  const validator = compileValidator(fields)
  assert.deepEqual(await validator.validate({ first: 7, second: 2 }, options), {
    first: 7,
    second: 2,
  })
  await assert.rejects(
    () => validator.validate({ first: 7, second: 3 }, options),
    /Validation failure/
  )
})
