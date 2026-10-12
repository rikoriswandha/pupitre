import { z } from 'zod'
import { defineCatalogExtension } from '@rikology/pupitre/catalog'
import type { PupitrePageProps, TableDescriptor, TableRow } from '@rikology/pupitre/catalog'
import { defineRegistry, PupitreRenderer, t, useBoundProp } from '@rikology/pupitre-react'
import { components } from '../../../src/components.js'

const extension = defineCatalogExtension({
  name: 'ct-rating',
  components: {
    StarRating: {
      kind: 'field',
      props: z.object({ max: z.number() }),
      description: 'Accessible rating input',
    },
    StarRatingColumn: {
      kind: 'column',
      props: z.object({ max: z.number() }),
      description: 'Rating table cell',
    },
    StarRatingEntry: {
      kind: 'entry',
      props: z.object({ max: z.number() }),
      description: 'Rating entry',
    },
  },
})
function StarRating({
  props,
  bindings,
}: {
  props: { max: number; value: unknown; label?: string | null }
  bindings?: Record<string, string>
}) {
  const [value, setValue] = useBoundProp(props.value, bindings?.value)
  return (
    <fieldset>
      <legend>{props.label}</legend>
      {Array.from({ length: props.max }, (_, index) => index + 1).map((score) => (
        <label key={score}>
          <input
            type="radio"
            name="score"
            value={score}
            checked={value === score}
            onChange={() => setValue(score)}
          />
          {t('{count} stars', { count: score })}
        </label>
      ))}
      <output aria-label={t('Selected rating')}>{String(value)}</output>
    </fieldset>
  )
}
function StarRatingColumn({
  props,
}: {
  props: {
    value: unknown
    max: number
    descriptor?: TableDescriptor['columns'][number]
    row?: TableRow
  }
}) {
  return (
    <span>
      {t('{value} of {max} stars for {row}', {
        value: String(props.value),
        max: props.max,
        row: String(props.row?.key),
      })}{' '}
      — {props.descriptor?.label}
    </span>
  )
}
function StarRatingEntry({
  props,
}: {
  props: { value: unknown; max: number; label?: string | null; record?: unknown }
}) {
  const record = props.record as { title?: string } | undefined
  return (
    <dl>
      <dt>{props.label}</dt>
      <dd>
        {t('{value} of {max} stars', {
          value: String(props.value),
          max: props.max,
        })}{' '}
        — {record?.title}
      </dd>
    </dl>
  )
}
const registry = defineRegistry(
  { ...components, StarRating, StarRatingColumn, StarRatingEntry },
  {
    extensions: [extension],
  }
)
const panel: PupitrePageProps['pupitre'] = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
}
export function ExtensionStory({ layout = 'table' }: { layout?: 'table' | 'grid' }) {
  const descriptor: TableDescriptor = {
    id: 'ratings',
    url: '/ratings',
    columns: [
      {
        name: 'score',
        label: t('Score'),
        type: 'custom',
        component: 'StarRatingColumn',
        sortable: false,
        searchable: false,
        props: { max: 5 },
      },
    ],
    filters: [],
    filtersLayout: 'above',
    perPageOptions: [10],
    searchable: false,
    searchDebounce: 0,
    selectable: false,
    bulkActions: [],
    layout,
  }
  const page: PupitrePageProps['page'] = {
    key: `ct:extension:${layout}`,
    kind: 'custom',
    title: t('Ratings'),
    breadcrumbs: [],
    spec: {
      root: 'root',
      elements: {
        root: { type: 'Group', props: {}, children: ['rating', 'entry', 'table'] },
        rating: {
          type: 'StarRating',
          props: {
            name: 'score',
            max: 5,
            label: t('Rating'),
            value: { $bindState: '/data/score' },
          },
        },
        entry: {
          type: 'StarRatingEntry',
          props: {
            max: 5,
            label: t('Saved rating'),
            value: 'Excellent',
            record: { title: 'Record A' },
          },
        },
        table: { type: 'DataTable', props: { descriptor } },
      },
    },
    state: { data: { score: 2 } },
    actions: { header: [] },
    catalogVersion: '1.0',
  }
  return (
    <>
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        data={{
          rows: [
            {
              key: 7,
              url: '/ratings/7',
              cells: { score: 'Excellent' },
              actions: [],
              selectable: false,
            },
          ],
          meta: { total: 1, perPage: 10, currentPage: 1, lastPage: 1, from: 1, to: 1 },
          query: {},
        }}
        runAction={async () => {}}
        upload={async () => ({})}
        toast={() => {}}
      />
    </>
  )
}
