import type { JsonRenderSpec } from './wire.js'

export const catalogFixtures = {
  Text: {
    root: 'root',
    elements: {
      root: {
        type: 'Text',
        props: {
          name: 'title',
          label: 'Title',
          value: { $bindState: '/data/title' },
          error: { $state: '/errors/title' },
          type: 'text',
          placeholder: 'Enter a title',
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Textarea: {
    root: 'root',
    elements: {
      root: {
        type: 'Textarea',
        props: { name: 'body', value: { $bindState: '/data/body' }, rows: 4 },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Number: {
    root: 'root',
    elements: {
      root: {
        type: 'Number',
        props: { name: 'quantity', value: { $bindState: '/data/quantity' }, min: 1 },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Hidden: {
    root: 'root',
    elements: {
      root: { type: 'Hidden', props: { name: 'token', value: { $bindState: '/data/token' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Select: {
    root: 'root',
    elements: {
      root: {
        type: 'Select',
        props: {
          name: 'status',
          value: { $bindState: '/data/status' },
          options: [{ value: 'draft', label: 'Draft' }],
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Checkbox: {
    root: 'root',
    elements: {
      root: { type: 'Checkbox', props: { name: 'active', value: { $bindState: '/data/active' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  CheckboxList: {
    root: 'root',
    elements: {
      root: {
        type: 'CheckboxList',
        props: {
          name: 'roles',
          value: { $bindState: '/data/roles' },
          options: [{ value: 'admin', label: 'Admin' }],
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Radio: {
    root: 'root',
    elements: {
      root: {
        type: 'Radio',
        props: {
          name: 'status',
          value: { $bindState: '/data/status' },
          options: [{ value: 'draft', label: 'Draft' }],
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Toggle: {
    root: 'root',
    elements: {
      root: { type: 'Toggle', props: { name: 'enabled', value: { $bindState: '/data/enabled' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  ToggleButtons: {
    root: 'root',
    elements: {
      root: {
        type: 'ToggleButtons',
        props: {
          name: 'status',
          value: { $bindState: '/data/status' },
          options: [{ value: 'draft', label: 'Draft' }],
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Date: {
    root: 'root',
    elements: {
      root: {
        type: 'Date',
        props: { name: 'publishedAt', value: { $bindState: '/data/publishedAt' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  DateTime: {
    root: 'root',
    elements: {
      root: {
        type: 'DateTime',
        props: { name: 'startsAt', value: { $bindState: '/data/startsAt' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Time: {
    root: 'root',
    elements: {
      root: { type: 'Time', props: { name: 'opensAt', value: { $bindState: '/data/opensAt' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Color: {
    root: 'root',
    elements: {
      root: {
        type: 'Color',
        props: { name: 'accent', value: { $bindState: '/data/accent' }, format: 'hex' },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Tags: {
    root: 'root',
    elements: {
      root: { type: 'Tags', props: { name: 'tags', value: { $bindState: '/data/tags' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  KeyValue: {
    root: 'root',
    elements: {
      root: {
        type: 'KeyValue',
        props: { name: 'metadata', value: { $bindState: '/data/metadata' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  RichEditor: {
    root: 'root',
    elements: {
      root: {
        type: 'RichEditor',
        props: {
          name: 'content',
          value: { $bindState: '/data/content' },
          toolbar: ['bold', 'italic'],
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  FileUpload: {
    root: 'root',
    elements: {
      root: {
        type: 'FileUpload',
        props: {
          name: 'cover',
          label: 'Cover',
          descriptor: {
            name: 'cover',
            uploadUrl: '/upload',
            deleteUrl: '/upload',
            multiple: false,
            image: true,
            reorderable: false,
            downloadable: true,
            previewable: true,
          },
          value: { $bindState: '/data/cover' },
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Repeater: {
    root: 'root',
    elements: {
      root: {
        type: 'Repeater',
        props: {
          descriptor: {
            name: 'items',
            minItems: 0,
            reorderable: true,
            collapsible: true,
            cloneable: true,
            addLabel: 'Add item',
            itemLabel: 'Item ${/data/items/0/sku}',
            defaultItems: [],
          },
        },
        children: ['item'],
      },
      child: { type: 'Text', props: { name: 'sku', label: 'SKU', value: { $bindItem: 'sku' } } },
      item: {
        type: 'RepeaterItem',
        props: { index: { $index: true }, itemLabel: 'Item ${/data/items/0/sku}' },
        children: ['child'],
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  RepeaterItem: {
    root: 'root',
    elements: {
      root: {
        type: 'RepeaterItem',
        props: { index: { $index: true }, itemLabel: 'Item ${/data/items/0/sku}' },
        children: ['child'],
      },
      child: { type: 'Text', props: { name: 'sku', label: 'SKU', value: { $bindItem: 'sku' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Form: {
    root: 'root',
    elements: {
      root: {
        type: 'Form',
        props: { method: 'post', url: '/posts', submitLabel: 'Save', dirtyGuard: true },
        children: ['child'],
      },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Grid: {
    root: 'root',
    elements: {
      root: { type: 'Grid', props: { columns: 2, gap: 4 }, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Section: {
    root: 'root',
    elements: {
      root: { type: 'Section', props: { heading: 'Details', columns: 2 }, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Fieldset: {
    root: 'root',
    elements: {
      root: { type: 'Fieldset', props: { label: 'Details', columns: 2 }, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Tabs: {
    root: 'root',
    elements: {
      root: {
        type: 'Tabs',
        props: {
          id: 'content',
          tabs: [
            { key: 'details', label: 'Details' },
            { key: 'media', label: 'Media' },
          ],
          active: { $bindState: '/ui/tabs/content' },
        },
        children: ['tab'],
      },
      child: {
        type: 'Text',
        props: { name: 'title', label: 'Title', value: { $bindState: '/data/title' } },
      },
      tab: { type: 'Tab', props: { key: 'details', label: 'Details' }, children: ['child'] },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Tab: {
    root: 'root',
    elements: {
      root: { type: 'Tab', props: { key: 'details', label: 'Details' }, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Group: {
    root: 'root',
    elements: {
      root: { type: 'Group', props: { relationship: 'author' }, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Split: {
    root: 'root',
    elements: {
      root: { type: 'Split', props: { from: 'md', ratio: 0.5 }, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Placeholder: {
    root: 'root',
    elements: {
      root: {
        type: 'Placeholder',
        props: {
          label: 'Summary',
          content: {
            $computed: 'concat',
            args: { first: 'Hello ', second: { $state: '/data/title' } },
          },
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Html: {
    root: 'root',
    elements: { root: { type: 'Html', props: { content: '<p>Safe content</p>' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Divider: {
    root: 'root',
    elements: { root: { type: 'Divider', props: {} } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Actions: {
    root: 'root',
    elements: { root: { type: 'Actions', props: { actions: [] } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  View: {
    root: 'root',
    elements: {
      root: { type: 'View', props: { component: 'PostSummary', props: {} }, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Fragment: {
    root: 'root',
    elements: {
      root: { type: 'Fragment', props: {}, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  DataTable: {
    root: 'root',
    elements: {
      root: {
        type: 'DataTable',
        props: {
          descriptor: {
            id: 'posts',
            url: '/posts',
            columns: [
              {
                name: 'title',
                label: 'Title',
                type: 'text',
                sortable: true,
                searchable: true,
                props: {},
              },
            ],
            filters: [],
            filtersLayout: 'dropdown',
            perPageOptions: [25],
            searchable: true,
            searchDebounce: 300,
            selectable: false,
            bulkActions: [],
            layout: 'table',
          },
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  ActionBar: {
    root: 'root',
    elements: {
      root: {
        type: 'ActionBar',
        props: {
          actions: [
            { name: 'create', label: 'Create', kind: 'link', url: '/posts/create', enabled: true },
          ],
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  Infolist: {
    root: 'root',
    elements: {
      root: { type: 'Infolist', props: {}, children: ['child'] },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  TextEntry: {
    root: 'root',
    elements: {
      root: {
        type: 'TextEntry',
        props: { label: 'Title', value: { $state: '/meta/record/title' }, html: false },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  IconEntry: {
    root: 'root',
    elements: {
      root: { type: 'IconEntry', props: { label: 'Status', value: 'check', icon: 'check' } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  ImageEntry: {
    root: 'root',
    elements: { root: { type: 'ImageEntry', props: { label: 'Cover', value: '/cover.png' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  ColorEntry: {
    root: 'root',
    elements: { root: { type: 'ColorEntry', props: { label: 'Accent', value: '#336699' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  KeyValueEntry: {
    root: 'root',
    elements: {
      root: { type: 'KeyValueEntry', props: { label: 'Metadata', value: { author: 'Ada' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  RepeatableEntry: {
    root: 'root',
    elements: {
      root: {
        type: 'RepeatableEntry',
        props: { label: 'History', value: [] },
        children: ['child'],
      },
      child: {
        type: 'Text',
        props: { name: 'sku', label: 'SKU', value: { $bindState: '/data/title' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  CodeEntry: {
    root: 'root',
    elements: { root: { type: 'CodeEntry', props: { label: 'Payload', value: '{}' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  BadgeEntry: {
    root: 'root',
    elements: {
      root: {
        type: 'BadgeEntry',
        props: { label: 'Status', value: 'Published', color: 'success' },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
} satisfies Record<string, JsonRenderSpec>
