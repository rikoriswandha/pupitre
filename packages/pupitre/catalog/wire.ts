import { z } from 'zod'
import { dynamic, jsonRenderExpression, visibilitySchema } from './expressions.js'

export const option = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
})
export type Option = z.infer<typeof option>

export const actionDescriptor = z.object({
  name: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  color: z.enum(['primary', 'secondary', 'success', 'warning', 'danger', 'gray']).optional(),
  kind: z.enum(['link', 'direct', 'confirm', 'form']),
  url: z.string(),
  method: z.enum(['get', 'post', 'put', 'patch', 'delete']).optional(),
  enabled: z.boolean(),
  openInNewTab: z.boolean().optional(),
  keyBindings: z.array(z.string()).optional(),
  confirm: z
    .object({
      heading: z.string(),
      description: z.string().optional(),
      submitLabel: z.string().optional(),
      cancelLabel: z.string().optional(),
      icon: z.string().optional(),
      destructive: z.boolean().optional(),
    })
    .optional(),
  modal: z
    .object({
      heading: z.string().optional(),
      description: z.string().optional(),
      width: z.enum(['sm', 'md', 'lg', 'xl', '2xl', 'full']).optional(),
      slideOver: z.boolean().optional(),
      submitLabel: z.string().optional(),
      cancelLabel: z.string().optional(),
      footerActions: z
        .array(
          z.object({
            name: z.string(),
            label: z.string(),
            kind: z.enum(['link', 'direct', 'confirm', 'form']),
            url: z.string(),
            enabled: z.boolean(),
          })
        )
        .optional(),
    })
    .optional(),
  deepLink: z.boolean().optional(),
  group: z.string().optional(),
})
export type ActionDescriptor = z.infer<typeof actionDescriptor>

export const formSpec = z.object({
  root: z.string(),
  elements: z.record(z.string(), z.unknown()),
  state: z.record(z.string(), z.unknown()).optional(),
})

export const columnDescriptor = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum([
    'text',
    'badge',
    'icon',
    'image',
    'color',
    'toggle',
    'select',
    'custom',
    'fragment',
  ]),
  sortable: z.boolean(),
  searchable: z.boolean(),
  toggleable: z.object({ hiddenByDefault: z.boolean() }).optional(),
  alignment: z.enum(['start', 'center', 'end']).optional(),
  wrap: z.boolean().optional(),
  width: z.string().optional(),
  props: z.record(z.string(), z.unknown()),
  editable: z.object({ url: z.string() }).optional(),
  summarize: z.array(z.enum(['sum', 'avg', 'count', 'min', 'max'])).optional(),
})
export type ColumnDescriptor = z.infer<typeof columnDescriptor>
const filterForm = z
  .object({ fields: z.array(z.unknown()).optional(), spec: formSpec.optional() })
  .optional()
export const filterDescriptor = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('select'),
    name: z.string(),
    label: z.string(),
    options: z.array(option).optional(),
    form: filterForm,
  }),
  z.object({ type: z.literal('ternary'), name: z.string(), label: z.string(), form: filterForm }),
  z.object({ type: z.literal('dateRange'), name: z.string(), label: z.string(), form: filterForm }),
  z.object({ type: z.literal('custom'), name: z.string(), label: z.string(), form: filterForm }),
])
export type FilterDescriptor = z.infer<typeof filterDescriptor>
export const tableDescriptor = z.object({
  id: z.string(),
  url: z.string(),
  columns: z.array(columnDescriptor),
  filters: z.array(filterDescriptor),
  filtersLayout: z.enum(['dropdown', 'above', 'slideover']),
  tabs: z
    .array(z.object({ key: z.string(), label: z.string(), badge: z.number().optional() }))
    .optional(),
  groups: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
  defaultSort: z.object({ column: z.string(), direction: z.enum(['asc', 'desc']) }).optional(),
  perPageOptions: z.array(z.union([z.number(), z.literal('all')])),
  searchable: z.boolean(),
  searchDebounce: z.number(),
  reorderable: z.object({ url: z.string() }).optional(),
  poll: z.number().optional(),
  selectable: z.boolean(),
  bulkActions: z.array(actionDescriptor),
  emptyState: z
    .object({
      heading: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
      action: actionDescriptor.optional(),
    })
    .optional(),
  layout: z.enum(['table', 'grid']),
})
export type TableDescriptor = z.infer<typeof tableDescriptor>
export const tableRow = z.object({
  key: z.union([z.string(), z.number()]),
  cells: z.record(z.string(), z.unknown()),
  actions: z.array(actionDescriptor),
  url: z.string().optional(),
  selectable: z.boolean(),
})
export type TableRow = z.infer<typeof tableRow>
export const tableMeta = z.object({
  total: z.number(),
  perPage: z.number(),
  currentPage: z.number(),
  lastPage: z.number(),
  from: z.number(),
  to: z.number(),
})
export type TableMeta = z.infer<typeof tableMeta>
export const tableData = z.object({
  rows: z.array(tableRow),
  meta: tableMeta,
  summary: z.record(z.string(), z.record(z.string(), z.union([z.number(), z.string()]))).optional(),
  groups: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        rows: z.array(tableRow),
        summary: z
          .record(z.string(), z.record(z.string(), z.union([z.number(), z.string()])))
          .optional(),
      })
    )
    .optional(),
  query: z.record(z.string(), z.unknown()),
})
export type TableData = z.infer<typeof tableData>

export const formDescriptor = z.object({
  method: z.enum(['post', 'put', 'patch']),
  url: z.string(),
  submitLabel: z.string(),
  cancelUrl: z.string().optional(),
  keyBindings: z.array(z.string()).optional(),
  dirtyGuard: z.boolean(),
})
export type FormDescriptor = z.infer<typeof formDescriptor>
export const repeaterDescriptor = z.object({
  name: z.string(),
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  reorderable: z.boolean(),
  collapsible: z.boolean(),
  collapsed: z.boolean().optional(),
  cloneable: z.boolean(),
  addLabel: z.string().optional(),
  itemLabel: dynamic(z.string()).optional(),
  grid: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
  defaultItems: z.array(z.record(z.string(), z.unknown())).optional(),
})
export type RepeaterDescriptor = z.infer<typeof repeaterDescriptor>
export const fileUploadDescriptor = z.object({
  name: z.string(),
  uploadUrl: z.string(),
  deleteUrl: z.string(),
  multiple: z.boolean(),
  accept: z.array(z.string()).optional(),
  maxSize: z.number().optional(),
  maxFiles: z.number().optional(),
  image: z.boolean(),
  directory: z.string().optional(),
  visibility: z.string().optional(),
  reorderable: z.boolean(),
  downloadable: z.boolean(),
  previewable: z.boolean(),
})
export type FileUploadDescriptor = z.infer<typeof fileUploadDescriptor>
export const uploadResponse = z.object({
  key: z.string(),
  url: z.string(),
  name: z.string(),
  size: z.number(),
  mime: z.string(),
})
export type UploadResponse = z.infer<typeof uploadResponse>

export const navItem = z.object({
  label: z.string(),
  url: z.string().optional(),
  icon: z.string().optional(),
  badge: z.union([z.string(), z.number()]).optional(),
  external: z.boolean().optional(),
  active: z.boolean().optional(),
  children: z
    .array(z.object({ label: z.string(), url: z.string().optional(), icon: z.string().optional() }))
    .optional(),
})
export type NavItem = z.infer<typeof navItem>
export const navGroup = z.object({
  label: z.string(),
  items: z.array(navItem),
  icon: z.string().optional(),
  sort: z.number().optional(),
  collapsible: z.boolean().optional(),
})
export type NavGroup = z.infer<typeof navGroup>
export const flashMessage = z.object({
  type: z.enum(['success', 'error', 'warning', 'info']),
  title: z.string(),
  body: z.string().optional(),
})
export type FlashMessage = z.infer<typeof flashMessage>
export const brand = z.object({
  name: z.string(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
})
export type Brand = z.infer<typeof brand>
export const themeVars = z.record(z.string(), z.string())
export type ThemeVars = z.infer<typeof themeVars>
export const panelFeatures = z.record(z.string(), z.boolean())
export type PanelFeatures = z.infer<typeof panelFeatures>
export const breadcrumb = z.object({ label: z.string(), url: z.string().optional() })
export type Breadcrumb = z.infer<typeof breadcrumb>

export const stateModel = z.record(z.string(), z.unknown())
export type StateModel = z.infer<typeof stateModel>
export const jsonPatchOp = z.discriminatedUnion('op', [
  z.object({ op: z.enum(['add', 'replace', 'test']), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal('remove'), path: z.string() }),
  z.object({ op: z.enum(['move', 'copy']), path: z.string(), from: z.string() }),
])
export type JsonPatchOp = z.infer<typeof jsonPatchOp>
export const patchResponse = z.object({ patch: z.array(jsonPatchOp) })
export type PatchResponse = z.infer<typeof patchResponse>

export const elementSchema = z.object({
  type: z.enum([
    'Text',
    'Textarea',
    'Number',
    'Hidden',
    'Select',
    'Checkbox',
    'CheckboxList',
    'Radio',
    'Toggle',
    'ToggleButtons',
    'Date',
    'DateTime',
    'Time',
    'Color',
    'Tags',
    'KeyValue',
    'RichEditor',
    'FileUpload',
    'Repeater',
    'RepeaterItem',
    'Form',
    'Grid',
    'Section',
    'Fieldset',
    'Tabs',
    'Tab',
    'Group',
    'Split',
    'Placeholder',
    'Html',
    'Divider',
    'Actions',
    'View',
    'Fragment',
    'DataTable',
    'ActionBar',
    'Infolist',
    'TextEntry',
    'IconEntry',
    'ImageEntry',
    'ColorEntry',
    'KeyValueEntry',
    'RepeatableEntry',
    'CodeEntry',
    'BadgeEntry',
  ]),
  props: z.record(z.string(), z.unknown()).default({}),
  children: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.array(z.string())).optional(),
  visible: visibilitySchema.optional(),
  repeat: z
    .object({ statePath: z.union([z.string(), jsonRenderExpression]), key: z.string().optional() })
    .optional(),
  watch: z
    .record(
      z.string(),
      z.array(
        z.object({ action: z.string(), params: z.record(z.string(), z.unknown()).optional() })
      )
    )
    .optional(),
  on: z
    .record(
      z.string(),
      z.array(
        z.object({
          action: z.string(),
          params: z.record(z.string(), z.unknown()).optional(),
          confirm: z.unknown().optional(),
          preventDefault: z.boolean().optional(),
        })
      )
    )
    .optional(),
})
export const jsonRenderSpec = z
  .object({
    root: z.string(),
    elements: z.record(z.string(), elementSchema),
    state: stateModel.optional(),
  })
  .superRefine((spec, ctx) => {
    if (!spec.elements[spec.root])
      ctx.addIssue({
        code: 'custom',
        path: ['root'],
        message: `Unknown root element "${spec.root}"`,
      })
  })
export type JsonRenderSpec = z.infer<typeof jsonRenderSpec>
export const actionFormResponse = z.object({
  spec: jsonRenderSpec,
  state: z.record(z.string(), z.unknown()),
  catalogVersion: z.string(),
})
export type ActionFormResponse = z.infer<typeof actionFormResponse>

export const pageProps = z.object({
  pupitre: z.object({
    panel: z.object({
      id: z.string(),
      path: z.string(),
      brand,
      theme: themeVars,
      features: panelFeatures,
    }),
    user: z
      .object({
        id: z.union([z.string(), z.number()]),
        name: z.string(),
        email: z.string(),
        avatarUrl: z.string().optional(),
        timezone: z.string().optional(),
      })
      .nullable(),
    tenant: z
      .object({
        id: z.union([z.string(), z.number()]),
        name: z.string(),
        slug: z.string().optional(),
      })
      .nullable(),
    tenants: z
      .array(z.object({ id: z.union([z.string(), z.number()]), name: z.string(), url: z.string() }))
      .optional(),
    nav: z.array(navGroup),
    flash: z.array(flashMessage),
    notifications: z.object({ unread: z.number() }).optional(),
    locale: z.string(),
    timezone: z.string(),
  }),
  page: z.object({
    key: z.string(),
    kind: z.enum(['list', 'create', 'edit', 'view', 'page', 'dashboard', 'auth', 'custom']),
    title: z.string(),
    breadcrumbs: z.array(breadcrumb),
    spec: jsonRenderSpec,
    state: stateModel,
    actions: z.object({ header: z.array(actionDescriptor) }),
    widgets: z.array(z.unknown()).optional(),
    relations: z.array(z.unknown()).optional(),
    deferred: z.array(z.string()).optional(),
    catalogVersion: z.string(),
    component: z.string().optional(),
  }),
  data: z.union([tableData, z.record(z.string(), z.unknown())]).optional(),
})
export type PupitrePageProps = z.infer<typeof pageProps>

export const expressionProp = dynamic(z.unknown())
