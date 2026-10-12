import { test } from '@japa/runner'
import { renderToStaticMarkup } from 'react-dom/server'
import { z } from 'zod'
import { defineCatalogExtension } from '@rikology/pupitre/catalog'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { defineRegistry } from '../src/registry/defineRegistry.js'
import type { HostRegistryComponents, PupitreRegistry } from '../src/registry/defineRegistry.js'
import { PupitreRenderer } from '../src/renderer/PupitreRenderer.js'

const extension = defineCatalogExtension({
  name: 'rating-test',
  components: {
    RatingEntry: {
      kind: 'entry',
      props: z.object({ max: z.number() }),
      description: 'Rating entry',
    },
  },
})
const builtins = {} as HostRegistryComponents
function RatingEntry({ props }: { props: { max: number; value: unknown; record?: unknown } }) {
  const record = props.record as { id: number }
  return (
    <span>
      {String(props.value)} / {props.max} / {record.id}
    </span>
  )
}
function assertRegistryTypes() {
  // @ts-expect-error extension components are required
  defineRegistry(builtins, { extensions: [extension] })
  defineRegistry(
    {
      ...builtins,
      // @ts-expect-error custom props must match the extension schema
      RatingEntry: (_context: { props: { max: string } }) => null,
    },
    { extensions: [extension] }
  )
}
void assertRegistryTypes
const panel = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
} as PupitrePageProps['pupitre']
function render(
  type: string,
  registry: PupitreRegistry,
  catalogExtensions?: PupitrePageProps['page']['catalogExtensions']
) {
  const page: PupitrePageProps['page'] = {
    key: 'registry-test',
    kind: 'custom',
    title: '',
    breadcrumbs: [],
    spec: {
      root: 'entry',
      elements: { entry: { type, props: { max: 5, value: 'Formatted', record: { id: 7 } } } },
    },
    state: {},
    actions: { header: [] },
    catalogVersion: '1.0',
    catalogExtensions,
  }
  return renderToStaticMarkup(
    <PupitreRenderer
      page={page}
      pupitre={panel}
      registry={registry}
      runAction={async () => {}}
      upload={async () => ({})}
      toast={() => {}}
    />
  )
}
test.group('catalog extension registry', () => {
  test('passes custom props, formatted value and record to a registered entry', ({ assert }) => {
    const registry = defineRegistry({ ...builtins, RatingEntry }, { extensions: [extension] })
    assert.equal(render('RatingEntry', registry), '<span>Formatted / 5 / 7</span>')
    assert.property(registry.registry, 'RatingEntry')
    assert.notProperty(registry.shell, 'RatingEntry')
  })
  test('preserves noncatalog host components in the shell registry', ({ assert }) => {
    const HostWidget = () => null
    const registry = defineRegistry(
      { ...builtins, HostWidget, RatingEntry },
      { extensions: [extension] }
    )
    assert.strictEqual(Reflect.get(registry.shell, 'HostWidget'), HostWidget)
  })
  test('rejects missing extension components with an actionable error', ({ assert }) => {
    assert.throws(
      () =>
        defineRegistry(builtins as HostRegistryComponents & { RatingEntry: typeof RatingEntry }, {
          extensions: [extension],
        }),
      /rating-test.*RatingEntry.*defineRegistry/
    )
  })
  test('unknown spec components fail instead of silently disappearing', ({ assert }) => {
    assert.throws(
      () => render('UnregisteredRating', defineRegistry(builtins)),
      /UnregisteredRating.*not registered.*defineRegistry/
    )
  })
  test('page declarations catch missing descriptor-only extension components before rendering', ({
    assert,
  }) => {
    const registry = defineRegistry({ ...builtins, RatingEntry }, { extensions: [extension] })
    assert.throws(
      () =>
        render('RatingEntry', registry, [
          {
            name: 'table-rating',
            components: ['MissingColumn'],
          },
        ]),
      /MissingColumn.*table-rating.*defineRegistry/
    )
  })
})
