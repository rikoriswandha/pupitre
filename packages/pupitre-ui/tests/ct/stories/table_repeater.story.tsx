import { defineRegistry, PupitreRenderer } from '@rikology/pupitre-react'
import type { PupitrePageProps } from '@rikology/pupitre/catalog'
import { components } from '../../../src/components.js'

const registry = defineRegistry(components)
const panel: PupitrePageProps['pupitre'] = {
  panel: { id: 'admin', path: '/admin', brand: { name: 'Admin' }, theme: {}, features: {} },
  user: null,
  tenant: null,
  nav: [],
  flash: [],
  locale: 'en',
  timezone: 'UTC',
}

export function TableRepeaterStory({
  disabled = false,
  readOnly = false,
  errors = false,
  choices = false,
}: {
  disabled?: boolean
  readOnly?: boolean
  errors?: boolean
  choices?: boolean
}) {
  const page: PupitrePageProps['page'] = {
    key: 'ct:table-repeater',
    kind: 'custom',
    title: 'Table repeater',
    breadcrumbs: [],
    actions: { header: [] },
    catalogVersion: '1.0',
    state: {
      data: {
        items: [
          { _key: 'a', _relationKey: 7, sku: 'A', qty: 1 },
          { _key: 'b', sku: 'B', qty: 2 },
        ],
      },
    },
    spec: {
      root: 'items',
      elements: {
        items: {
          type: 'Repeater',
          props: {
            name: 'items',
            label: 'Line items',
            disabled,
            readOnly,
            value: { $bindState: '/data/items' },
            descriptor: {
              name: 'items',
              minItems: 1,
              maxItems: 3,
              reorderable: true,
              collapsible: false,
              cloneable: true,
              table: [
                { label: 'SKU', width: '8rem', required: true },
                { label: 'Qty', alignment: 'end' },
                ...(choices ? [{ label: 'Priority' }, { label: 'Channels' }] : []),
                ...(choices ? [{ label: 'Rating' }] : []),
              ],
            },
          },
          repeat: { statePath: '/data/items', key: '_key' },
          children: ['item'],
          on: {
            add: [
              {
                action: 'pushState',
                params: { statePath: '/data/items', value: { _key: '$id', sku: '', qty: 1 } },
              },
            ],
          },
        },
        item: {
          type: 'RepeaterItem',
          props: { index: { $index: true } },
          children: ['sku', 'qty', ...(choices ? ['priority', 'channels', 'rating'] : [])],
        },
        sku: {
          type: 'Text',
          props: { name: 'sku', label: 'SKU', required: true, value: { $bindItem: 'sku' } },
        },
        qty: {
          type: 'Number',
          props: { name: 'qty', label: 'Qty', value: { $bindItem: 'qty' }, min: 1 },
        },
        priority: {
          type: 'Radio',
          props: {
            name: 'priority',
            label: 'Priority',
            options: [
              { value: 'normal', label: 'Normal' },
              { value: 'urgent', label: 'Urgent' },
            ],
            value: { $bindItem: 'priority' },
          },
        },
        channels: {
          type: 'CheckboxList',
          props: {
            name: 'channels',
            label: 'Channels',
            options: [
              { value: 'email', label: 'Email' },
              { value: 'sms', label: 'SMS' },
            ],
            value: { $bindItem: 'channels' },
          },
        },
        rating: {
          type: 'Slider',
          props: { name: 'rating', label: 'Rating', value: { $bindItem: 'rating' } },
        },
      },
    },
  }
  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <PupitreRenderer
        page={page}
        pupitre={panel}
        registry={registry}
        runAction={async () => {}}
        upload={async () => ({})}
        toast={() => {}}
        errors={errors ? { 'items.1.sku': 'Invalid SKU' } : undefined}
        onStore={(store) => {
          ;(window as Window & { tableRepeaterStore?: typeof store }).tableRepeaterStore = store
        }}
      />
    </div>
  )
}
