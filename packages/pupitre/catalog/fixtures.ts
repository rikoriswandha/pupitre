import type { JsonRenderSpec } from './wire.js'

export const catalogFixtures = {
  'Text': {
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
          mask: '99/99/9999',
          hint: 'A date for this record.',
          hintIcon: 'circle-help',
          hintTooltip: 'Date format: MM/DD/YYYY.',
          hintAction: {
            name: 'hint-help',
            label: 'Hint action',
            kind: 'link',
            url: '/help',
            enabled: true,
          },
          prefix: 'From',
          prefixAction: {
            name: 'prefix-action',
            label: 'Prefix action',
            kind: 'link',
            url: '/prefix',
            enabled: true,
          },
          suffix: 'to',
          suffixAction: {
            name: 'suffix-action',
            label: 'Suffix action',
            kind: 'link',
            url: '/suffix',
            enabled: true,
          },
        },
      },
    },
    state: { data: { title: '01012024', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Textarea': {
    root: 'root',
    elements: {
      root: {
        type: 'Textarea',
        props: { name: 'body', value: { $bindState: '/data/body' }, rows: 2, autosize: true },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Number': {
    root: 'root',
    elements: {
      root: {
        type: 'Number',
        props: { name: 'quantity', value: { $bindState: '/data/quantity' }, min: 1 },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Slider': {
    root: 'root',
    elements: {
      root: {
        type: 'Slider',
        props: {
          name: 'priority',
          label: 'Priority',
          value: { $bindState: '/data/priority' },
          min: 0,
          max: 100,
          step: 5,
          marks: [0, 50, 100],
        },
      },
    },
    state: { data: { priority: 20 }, errors: {} },
  },
  'Hidden': {
    root: 'root',
    elements: {
      root: { type: 'Hidden', props: { name: 'token', value: { $bindState: '/data/token' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Select': {
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
  'Checkbox': {
    root: 'root',
    elements: {
      root: { type: 'Checkbox', props: { name: 'active', value: { $bindState: '/data/active' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'CheckboxList': {
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
  'Radio': {
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
  'Toggle': {
    root: 'root',
    elements: {
      root: { type: 'Toggle', props: { name: 'enabled', value: { $bindState: '/data/enabled' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'ToggleButtons': {
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
  'Date': {
    root: 'root',
    elements: {
      root: {
        type: 'Date',
        props: { name: 'publishedAt', value: { $bindState: '/data/publishedAt' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'DateTime': {
    root: 'root',
    elements: {
      root: {
        type: 'DateTime',
        props: { name: 'startsAt', value: { $bindState: '/data/startsAt' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Time': {
    root: 'root',
    elements: {
      root: { type: 'Time', props: { name: 'opensAt', value: { $bindState: '/data/opensAt' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Color': {
    root: 'root',
    elements: {
      root: {
        type: 'Color',
        props: { name: 'accent', value: { $bindState: '/data/accent' }, format: 'hex' },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Tags': {
    root: 'root',
    elements: {
      root: { type: 'Tags', props: { name: 'tags', value: { $bindState: '/data/tags' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'KeyValue': {
    root: 'root',
    elements: {
      root: {
        type: 'KeyValue',
        props: { name: 'metadata', value: { $bindState: '/data/metadata' } },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'RichEditor': {
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
  'MarkdownEditor': {
    root: 'root',
    elements: {
      root: {
        type: 'MarkdownEditor',
        props: {
          name: 'summary',
          value: { $bindState: '/data/summary' },
          toolbar: ['bold', 'italic', 'link', 'image'],
          uploadUrl: '/upload',
          preview: true,
        },
      },
    },
    state: { data: { summary: '# Article' } },
  },
  'CodeEditor': {
    root: 'root',
    elements: {
      root: {
        type: 'CodeEditor',
        props: {
          name: 'config',
          value: { $bindState: '/data/config' },
          language: 'json',
          lineNumbers: true,
          minHeight: 180,
        },
      },
    },
    state: { data: { config: '{}' } },
  },
  'FileUpload': {
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
            imageEditor: true,
            imageEditorAspectRatios: ['16:9', '4:3', '1:1', null],
          },
          value: { $bindState: '/data/cover' },
        },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Repeater': {
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
            defaultItems: [],
          },
        },
        children: ['item'],
      },
      child: { type: 'Text', props: { name: 'sku', label: 'SKU', value: { $bindItem: 'sku' } } },
      item: {
        type: 'RepeaterItem',
        props: { index: { $index: true }, itemLabel: { $template: 'Item ${sku}' } },
        children: ['child'],
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'RepeaterItem': {
    root: 'root',
    elements: {
      root: {
        type: 'RepeaterItem',
        props: { index: { $index: true }, itemLabel: { $template: 'Item ${sku}' } },
        children: ['child'],
      },
      child: { type: 'Text', props: { name: 'sku', label: 'SKU', value: { $bindItem: 'sku' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Builder': {
    root: 'root',
    elements: {
      root: {
        type: 'Builder',
        props: {
          descriptor: {
            name: 'content',
            blocks: [{ key: 'heading', label: 'Heading', template: 'item' }],
            reorderable: true,
            collapsible: true,
            cloneable: true,
          },
          value: { $bindState: '/data/content' },
        },
        children: ['item'],
        repeat: { statePath: '/data/content', key: '_key' },
      },
      item: {
        type: 'BuilderItem',
        props: { block: 'heading', index: { $index: true } },
        children: ['field'],
      },
      field: { type: 'Text', props: { name: 'title', value: { $bindItem: 'data.title' } } },
    },
    state: { data: { content: [{ _key: 'one', type: 'heading', data: { title: 'Welcome' } }] } },
  },
  'BuilderItem': {
    root: 'root',
    elements: {
      root: {
        type: 'BuilderItem',
        props: { block: 'heading', index: { $index: true } },
        children: ['field'],
      },
      field: { type: 'Text', props: { name: 'title', value: { $bindItem: 'data.title' } } },
    },
    state: { data: { content: [{ _key: 'one', type: 'heading', data: { title: 'Welcome' } }] } },
  },
  'Form': {
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
  'Grid': {
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
  'Section': {
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
  'Fieldset': {
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
  'Tabs': {
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
  'Tab': {
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
  'Wizard': {
    root: 'root',
    elements: {
      'root': {
        type: 'Wizard',
        props: {
          id: 'l.0',
          steps: [
            { key: 'account', label: 'Account' },
            { key: 'profile', label: 'Profile' },
          ],
          step: { $bindState: '/ui/wizard/l.0/step' },
          skippable: false,
        },
        children: ['step', 'profile-step'],
      },
      'step': { type: 'Step', props: { key: 'account', label: 'Account' }, children: ['field'] },
      'profile-step': {
        type: 'Step',
        props: { key: 'profile', label: 'Profile' },
        children: ['profile-field'],
      },
      'field': { type: 'Text', props: { name: 'email', value: { $bindState: '/data/email' } } },
      'profile-field': {
        type: 'Text',
        props: { name: 'name', value: { $bindState: '/data/name' } },
      },
    },
    state: { data: { email: '', name: '' }, ui: { wizard: { 'l.0': { step: 0 } } } },
  },
  'Step': {
    root: 'root',
    elements: {
      root: { type: 'Step', props: { key: 'account', label: 'Account' }, children: ['field'] },
      field: { type: 'Text', props: { name: 'email', value: { $bindState: '/data/email' } } },
    },
    state: { data: { email: '' } },
  },
  'Group': {
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
  'Split': {
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
  'Placeholder': {
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
  'Html': {
    root: 'root',
    elements: { root: { type: 'Html', props: { content: '<p>Safe content</p>' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Divider': {
    root: 'root',
    elements: { root: { type: 'Divider', props: {} } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'Actions': {
    root: 'root',
    elements: { root: { type: 'Actions', props: { actions: [] } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'View': {
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
  'Fragment': {
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
  'DataTable': {
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
            filters: [
              {
                type: 'custom',
                name: 'advanced',
                label: 'Advanced',
                form: {
                  spec: {
                    $raw: {
                      root: 'search',
                      elements: {
                        search: {
                          type: 'Text',
                          props: { name: 'term', value: { $bindState: '/data/term' } },
                        },
                      },
                      state: { data: { term: 'seeded' } },
                    },
                  },
                },
              },
            ],
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
  'Widget.Stats': {
    root: 'root',
    elements: {
      root: {
        type: 'Widget.Stats',
        props: {
          descriptor: { name: 'posts', kind: 'stats', dataProp: 'widget_posts', span: 2, sort: 1 },
          data: { kind: 'stats', stats: [{ label: 'Published', value: 12, chart: [2, 4, 6] }] },
        },
      },
    },
  },
  'Widget.Chart': {
    root: 'root',
    elements: {
      root: {
        type: 'Widget.Chart',
        props: {
          descriptor: {
            name: 'trend',
            kind: 'chart',
            dataProp: 'widget_trend',
            span: 2,
            sort: 2,
            chartType: 'line',
          },
          data: {
            kind: 'chart',
            labels: ['Jan', 'Feb'],
            datasets: [{ label: 'Posts', data: [4, 7] }],
          },
        },
      },
    },
  },
  'Widget.Timeline': {
    root: 'root',
    elements: {
      root: {
        type: 'Widget.Timeline',
        props: {
          descriptor: {
            name: 'activity',
            kind: 'timeline',
            dataProp: 'widget_activity',
            heading: 'Activity',
            span: 2,
            sort: 3,
          },
          data: {
            kind: 'timeline',
            items: [
              {
                title: 'Post updated',
                actor: 'Ada',
                time: { iso: '2026-10-11T10:00:00Z', formatted: '11 Oct 2026, 10:00' },
                changes: [{ field: 'status', old: 'draft', new: 'published' }],
              },
            ],
          },
        },
      },
    },
  },
  'Widget.Table': {
    root: 'root',
    elements: {
      root: {
        type: 'Widget.Table',
        props: {
          descriptor: {
            name: 'latest',
            kind: 'table',
            dataProp: 'widget_latest',
            span: 'full',
            sort: 3,
          },
          data: {
            kind: 'table',
            data: {
              rows: [],
              meta: { total: 0, perPage: 10, currentPage: 1, lastPage: 1, from: 0, to: 0 },
              query: {},
            },
          },
        },
      },
    },
  },
  'RelationManager': {
    root: 'root',
    elements: {
      root: {
        type: 'RelationManager',
        props: {
          descriptor: {
            key: 'comments',
            relation: 'comments',
            label: 'Comments',
            badge: 7,
            url: '/posts/1/relations/comments',
            dataProp: 'commentsData',
            queryPrefix: 'comments',
            readOnly: true,
            table: {
              id: 'posts.comments',
              url: '/posts/1/relations/comments',
              dataProp: 'commentsData',
              queryPrefix: 'comments',
              columns: [],
              filters: [],
              filtersLayout: 'dropdown',
              perPageOptions: [25],
              searchable: false,
              searchDebounce: 300,
              selectable: false,
              bulkActions: [],
              layout: 'table',
            },
            actions: {
              header: [
                { name: 'attach', label: 'Attach', kind: 'form', url: '/attach', enabled: true },
              ],
              row: [],
              bulk: [],
            },
          },
        },
      },
    },
    state: { data: {}, errors: {} },
  },
  'ActionBar': {
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
  'Infolist': {
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
  'TextEntry': {
    root: 'root',
    elements: {
      root: {
        type: 'TextEntry',
        props: { label: 'Title', value: { $state: '/meta/record/title' }, html: false },
      },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'IconEntry': {
    root: 'root',
    elements: {
      root: { type: 'IconEntry', props: { label: 'Status', value: 'check', icon: 'check' } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'ImageEntry': {
    root: 'root',
    elements: { root: { type: 'ImageEntry', props: { label: 'Cover', value: '/cover.png' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'ColorEntry': {
    root: 'root',
    elements: { root: { type: 'ColorEntry', props: { label: 'Accent', value: '#336699' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'KeyValueEntry': {
    root: 'root',
    elements: {
      root: { type: 'KeyValueEntry', props: { label: 'Metadata', value: { author: 'Ada' } } },
    },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'RepeatableEntry': {
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
  'CodeEntry': {
    root: 'root',
    elements: { root: { type: 'CodeEntry', props: { label: 'Payload', value: '{}' } } },
    state: { data: { title: 'Example', items: [{ sku: 'ABC' }] }, errors: { title: 'Required' } },
  },
  'BadgeEntry': {
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
