import { SpecCache } from '../../../src/compiler/cache.js'
import { test } from '@japa/runner'
import { z } from 'zod'
import vine from '@vinejs/vine'
import { defineCatalogExtension, mergeCatalogExtensions } from '../../../catalog/index.js'
import {
  defineField,
  defineColumn,
  defineEntry,
  definePlugin,
  schema,
  compileValidator,
  action,
  definePage,
} from '../../../index.js'
import { Table } from '../../../src/builder/table/table.js'
import { compileForm, compileInfolist } from '../../../src/compiler/schema_compiler.js'
import { compileTable } from '../../../src/compiler/table_compiler.js'
import { compileActionForm } from '../../../src/compiler/action_compiler.js'
import type { HttpContext } from '@adonisjs/core/http'

const extension = defineCatalogExtension({
  name: 'test-rating',
  components: {
    TestRating: {
      kind: 'field',
      props: z.object({ max: z.number().int().min(1).max(10).default(5) }),
      description: 'Rating input',
    },
    TestRatingColumn: {
      kind: 'column',
      props: z.object({ max: z.number().default(5) }),
      description: 'Rating column',
    },
    TestRatingEntry: {
      kind: 'entry',
      props: z.object({ max: z.number().default(5) }),
      description: 'Rating entry',
    },
  },
})
const rating = defineField('testRating', {
  extension,
  component: 'TestRating',
  methods: { stars: (max: number) => ({ max }) },
  validate: (props) => vine.number().withoutDecimals().min(0).max(props.max),
  dehydrate: (value) => Number(value) * 2,
})
const ratingColumn = defineColumn('testRating', {
  extension,
  component: 'TestRatingColumn',
  methods: { stars: (max: number) => ({ max }) },
  format: (value) => Number(value) / 2,
})
const ratingEntry = defineEntry('testRating', {
  extension,
  component: 'TestRatingEntry',
  methods: { stars: (max: number) => ({ max }) },
  format: (value) => Number(value) / 2,
})
const options = {
  locale: 'en',
  timezone: 'UTC',
  form: { method: 'post' as const, url: '/ratings', submitLabel: 'Save', dirtyGuard: true },
}

test.group('catalog extensions', () => {
  test('rejects unknown compiled component names on the server despite open wire types', async ({
    assert,
  }) => {
    const cache = new SpecCache()
    cache.set('typo', {
      spec: { root: 'root', elements: { root: { type: 'Textt', props: {} } } },
      slots: [],
    })
    await assert.rejects(
      () =>
        compileForm([rating('score').toDefinition()], {
          ...options,
          cache: { key: 'typo', store: cache },
        }),
      /Unknown Pupitre component.*Textt/
    )
  })
  test('retains refined custom prop schemas across successive typed methods', ({ assert }) => {
    const refined = defineCatalogExtension({
      name: 'refined-score',
      components: {
        RefinedScore: {
          kind: 'field',
          props: z
            .object({ min: z.number(), max: z.number() })
            .refine((props) => props.min < props.max, 'min must be less than max'),
          description: 'Refined score',
        },
      },
    })
    const range = defineField('refinedScore', {
      extension: refined,
      component: 'RefinedScore',
      methods: { minimum: (min: number) => ({ min }), maximum: (max: number) => ({ max }) },
      validate: (props) => vine.number().min(props.min).max(props.max),
    })
    assert.deepEqual(
      range('score').minimum(1).label('Score').maximum(5).toDefinition().extensionProps,
      { min: 1, max: 5 }
    )
    assert.throws(
      () => range('score').minimum(5).maximum(1).toDefinition(),
      /min must be less than max/
    )
    assert.isDefined(mergeCatalogExtensions([refined]).components.RefinedScore)
  })
  test('never lets extension defaults replace framework binding or base props', async ({
    assert,
  }) => {
    const defaults = defineCatalogExtension({
      name: 'default-score',
      components: {
        DefaultScore: {
          kind: 'field',
          props: z.object({
            value: z.number().default(0),
            name: z.string().default('wrong'),
            label: z.string().default('wrong'),
            disabled: z.boolean().default(false),
            required: z.boolean().default(false),
            error: z.string().default('wrong'),
          }),
          description: 'Common prop defaults',
        },
      },
    })
    const custom = defineField('defaultScore', {
      extension: defaults,
      component: 'DefaultScore',
      validate: () => vine.number(),
    })
    const compiled = await compileForm(
      [custom('score').label('Score').disabled(true).required().toDefinition()],
      options
    )
    assert.deepEqual(compiled.spec.elements['f.score'].props, {
      name: 'score',
      label: 'Score',
      value: { $bindState: '/data/score' },
      error: { $state: '/errors/score' },
      required: true,
      disabled: true,
    })
  })
  test('inherits immutable field methods without losing custom methods', ({ assert }) => {
    const initial = rating('score').stars(7)
    const required = initial
      .label('Score')
      .required()
      .nullable()
      .readOnly()
      .columnSpan('full')
      .live()
      .stars(8)
    assert.equal(initial.toDefinition().extensionProps.max, 7)
    assert.deepEqual(required.toDefinition().rules, { required: true, nullable: true })
    assert.equal(required.toDefinition().readOnly, true)
    assert.equal(required.toDefinition().columnSpan, 'full')
    assert.equal(required.toDefinition().extensionProps.max, 8)
  })
  test('rejects invalid custom props in builder and compiler', async ({ assert }) => {
    assert.throws(() => rating('score').stars(0), /Invalid props.*TestRating/)
    const node = rating('score').toDefinition()
    node.extensionProps = { max: 0 }
    await assert.rejects(() => compileForm([node], options), /Invalid props.*TestRating/)
  })
  test('validates required nullable and custom Vine values before dehydration', async ({
    assert,
  }) => {
    const validator = compileValidator([
      rating('score').stars(7).required().toDefinition(),
      rating('optional')
        .nullable()
        .dehydrate((value) => value)
        .toDefinition(),
    ])
    assert.deepEqual(await validator.validate({ score: 6, optional: null }, { timezone: 'UTC' }), {
      score: 12,
      optional: null,
    })
    await assert.rejects(() => validator.validate({}, { timezone: 'UTC' }), /Validation failure/)
    await assert.rejects(
      () => validator.validate({ score: 8 }, { timezone: 'UTC' }),
      /Validation failure/
    )
    await assert.rejects(
      () => validator.validate({ score: 1.5 }, { timezone: 'UTC' }),
      /Validation failure/
    )
  })
  test('applies additional custom Vine rules', async ({ assert }) => {
    const even = vine.createRule((value, _args, field) => {
      if (typeof value === 'number' && value % 2 !== 0)
        field.report('Rating must be even', 'even', field)
    })
    const validator = compileValidator([rating('score').required().rules([even()]).toDefinition()])
    assert.deepEqual(await validator.validate({ score: 2 }, { timezone: 'UTC' }), { score: 4 })
    await assert.rejects(
      () => validator.validate({ score: 3 }, { timezone: 'UTC' }),
      /Validation failure/
    )
  })
  test('compiles action modal and custom page forms through their public builders', async ({
    assert,
  }) => {
    const formAction = action('rate')
      .form([rating('score').required()])
      .fillForm(() => ({ score: 3 })).definition
    const modal = await compileActionForm(formAction, {
      locale: 'en',
      timezone: 'UTC',
      ctx: {} as HttpContext,
      url: '/rate',
    })
    assert.equal(modal.spec.elements['f.score'].type, 'TestRating')
    const page = definePage('rating')
      .form(() => [rating('score').required()])
      .toDefinition()
    const compiled = await compileForm(page.form ?? [], options)
    assert.equal(compiled.spec.elements['f.score'].type, 'TestRating')
  })
  test('validates and dehydrates inside repeaters and builder blocks', async ({ assert }) => {
    const nodes = [
      schema
        .repeater('items')
        .schema([rating('score').required()])
        .toDefinition(),
      schema
        .builder('blocks')
        .blocks([schema.block('review').schema([rating('score').required()])])
        .toDefinition(),
    ]
    const validator = compileValidator(nodes)
    assert.deepEqual(
      await validator.validate(
        { items: [{ score: 3 }], blocks: [{ type: 'review', data: { score: 2 } }] },
        { timezone: 'UTC' }
      ),
      { items: [{ score: 6 }], blocks: [{ type: 'review', data: { score: 4 } }] }
    )
    await assert.rejects(
      () => validator.validate({ items: [{ score: 12 }] }, { timezone: 'UTC' }),
      /Validation failure/
    )
  })
  test('compiles binding errors visibility watch and extension element types', async ({
    assert,
  }) => {
    const compiled = await compileForm(
      [
        rating('score')
          .label('Score')
          .required()
          .stars(7)
          .visible(({ get }) => get('enabled') === true)
          .live()
          .afterStateUpdated(({ get, set }) => set('mirror', get('score')))
          .toDefinition(),
        schema
          .repeater('items')
          .schema([rating('score')])
          .toDefinition(),
      ],
      { ...options, data: { enabled: true, score: 4, items: [{ score: 2 }] } }
    )
    assert.equal(compiled.spec.elements['f.score'].type, 'TestRating')
    assert.deepEqual(compiled.spec.elements['f.score'].props.value, { $bindState: '/data/score' })
    assert.deepEqual(compiled.spec.elements['f.score'].props.error, { $state: '/errors/score' })
    assert.isDefined(compiled.spec.elements['f.score'].visible)
    assert.isDefined(compiled.spec.elements['f.score'].watch)
    assert.deepEqual(compiled.spec.elements['f.items.score'].props.value, { $bindItem: 'score' })
    assert.snapshot(compiled.spec).match()
  })
  test('compiles table column and infolist entry extension descriptors', async ({ assert }) => {
    const definition = new Table({
      columns: [],
      filters: [],
      filtersLayout: 'dropdown',
      searchDebounce: 300,
      paginated: [10, 25],
      striped: false,
    })
      .columns([
        ratingColumn('score')
          .label('Score')
          .stars(7)
          .sortable()
          .searchable({ individually: true })
          .toggleable({ hiddenByDefault: true }),
      ])
      .toDefinition()
    const descriptor = await compileTable(definition, {
      url: '/ratings',
      id: 'ratings',
      bulkActions: [],
      compileFilterForm: async () => ({
        root: 'root',
        elements: { root: { type: 'Fragment', props: {} } },
      }),
    })
    assert.equal(descriptor.columns[0].component, 'TestRatingColumn')
    assert.deepEqual(descriptor.columns[0].props, { max: 7 })
    assert.isTrue(descriptor.columns[0].sortable)
    const entry = await compileInfolist(
      [ratingEntry('score').label('Score').stars(7).toDefinition()],
      { locale: 'en', timezone: 'UTC', record: { score: 8 } }
    )
    assert.equal(entry.spec.elements['f.score'].type, 'TestRatingEntry')
    assert.equal(entry.spec.elements['f.score'].props.value, 4)
    assert.deepEqual(entry.spec.elements['f.score'].props.record, { score: 8 })
    assert.snapshot({ descriptor, entry: entry.spec }).match()
  })
  test('rejects builtin and extension component collisions', ({ assert }) => {
    assert.throws(
      () =>
        defineCatalogExtension({
          name: 'bad',
          components: { Text: { kind: 'field', props: z.object({}), description: '' } },
        }),
      /collides.*built-in/
    )
    assert.throws(() => mergeCatalogExtensions([extension, extension]), /Duplicate.*extension/)
    assert.throws(
      () => mergeCatalogExtensions([extension, { ...extension, name: 'another' }]),
      /component.*collides/
    )
    assert.throws(
      () =>
        defineField('number', {
          extension,
          component: 'TestRating',
          validate: () => vine.number(),
        }),
      /built-in kind/
    )
    assert.throws(
      () =>
        defineField('testRating', {
          extension,
          component: 'TestRating',
          validate: () => vine.number(),
        }),
      /Duplicate/
    )
    assert.throws(
      () =>
        defineField('wrongComponentKind', {
          extension,
          component: 'TestRatingEntry',
          validate: () => vine.number(),
        }),
      /not a field/
    )
  })
  test('validates plugin extension registration eagerly', ({ assert }) => {
    assert.equal(definePlugin({ name: 'rating', catalog: [extension] }).catalog[0], extension)
    assert.throws(
      () => definePlugin({ name: 'rating', catalog: [extension, extension] }),
      /Duplicate/
    )
  })
})
