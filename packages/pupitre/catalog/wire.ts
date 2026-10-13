import './csp.js'

import { z } from 'zod'
import { dynamic, jsonRenderExpression, raw, visibilitySchema } from './expressions.js'

export const realtimeEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pupitre:notification') }),
  z.object({ type: z.literal('pupitre:table'), resource: z.string() }),
])
export type RealtimeEvent = z.infer<typeof realtimeEvent>
export type RealtimeClient = {
  subscribe(channel: string, onEvent: (event: RealtimeEvent) => void): () => void
}

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
  variant: z.enum(['button', 'link', 'iconButton']).optional(),
  color: z.enum(['primary', 'secondary', 'success', 'warning', 'danger', 'gray']).optional(),
  kind: z.enum(['link', 'direct', 'confirm', 'form']),
  url: z.string(),
  method: z.enum(['get', 'post', 'put', 'patch', 'delete']).optional(),
  enabled: z.boolean(),
  openInNewTab: z.boolean().optional(),
  keyBindings: z.array(z.string()).optional(),
  exportFormats: z
    .array(z.enum(['csv', 'xlsx']))
    .min(1)
    .optional(),
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
      icon: z.string().optional(),
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
            method: z.enum(['get', 'post', 'put', 'patch', 'delete']).optional(),
            openInNewTab: z.boolean().optional(),
            confirm: z
              .object({ heading: z.string(), description: z.string().optional() })
              .optional(),
          })
        )
        .optional(),
      submit: z.boolean().optional(),
      cancel: z.boolean().optional(),
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
  component: z.string().optional(),
  type: z.enum([
    'text',
    'badge',
    'icon',
    'image',
    'color',
    'toggle',
    'select',
    'checkbox',
    'textInput',
    'custom',
    'fragment',
  ]),
  sortable: z.boolean(),
  searchable: z.boolean(),
  toggleable: z.object({ hiddenByDefault: z.boolean() }).optional(),
  individuallySearchable: z.boolean().optional(),
  alignment: z.enum(['start', 'center', 'end']).optional(),
  wrap: z.boolean().optional(),
  width: z.string().optional(),
  props: z.record(z.string(), z.unknown()),
  editable: z.object({ url: z.string() }).optional(),
  summarize: z.array(z.enum(['sum', 'avg', 'count', 'min', 'max', 'range'])).optional(),
})
export type ColumnDescriptor = z.infer<typeof columnDescriptor>
const filterForm = z
  .object({ fields: z.array(z.unknown()).optional(), spec: raw(formSpec).optional() })
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
  z.object({ type: z.literal('trashed'), name: z.string(), label: z.string(), form: filterForm }),
  z.object({ type: z.literal('custom'), name: z.string(), label: z.string(), form: filterForm }),
  z.object({
    type: z.literal('queryBuilder'),
    name: z.string(),
    label: z.string(),
    form: filterForm,
    constraints: z.array(
      z.object({
        name: z.string(),
        type: z.enum(['text', 'number', 'date', 'boolean', 'select', 'relationship']),
        label: z.string(),
        options: z.array(option).optional(),
        operators: z.array(z.object({ value: z.string(), label: z.string() })),
      })
    ),
  }),
])
export type FilterDescriptor = z.infer<typeof filterDescriptor>
export const tableViewDescriptor = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  query: z.record(z.string(), z.unknown()),
  columns: z.record(z.string(), z.boolean()).optional(),
  source: z.enum(['preset', 'public', 'mine']),
  editable: z.boolean(),
  isPublic: z.boolean(),
  isDefault: z.boolean(),
})
export type TableViewDescriptor = z.infer<typeof tableViewDescriptor>
export const tableDescriptor = z.object({
  id: z.string(),
  url: z.string(),
  dataProp: z.string().optional(),
  queryPrefix: z.string().optional(),
  views: z
    .object({
      url: z.string(),
      enabled: z.boolean(),
      canManagePublic: z.boolean(),
      items: z.array(tableViewDescriptor),
    })
    .optional(),
  columns: z.array(columnDescriptor),
  filters: z.array(filterDescriptor),
  filtersLayout: z.enum(['dropdown', 'above', 'slideover']),
  tabs: z
    .array(z.object({ key: z.string(), label: z.string(), badge: z.number().optional() }))
    .optional(),
  groups: z
    .array(z.object({ key: z.string(), label: z.string(), collapsible: z.boolean().optional() }))
    .optional(),
  defaultSort: z.object({ column: z.string(), direction: z.enum(['asc', 'desc']) }).optional(),
  defaultSorts: z
    .array(z.object({ column: z.string(), direction: z.enum(['asc', 'desc']) }))
    .optional(),
  multiSort: z.number().int().min(1).max(10).optional(),
  perPageOptions: z.array(z.union([z.number(), z.literal('all')])),
  searchable: z.boolean(),
  searchDebounce: z.number(),
  reorderable: z.object({ url: z.string() }).optional(),
  poll: z.number().optional(),
  realtime: z.object({ channel: z.string() }).optional(),
  deferFilters: z.boolean().optional(),
  deferLoading: z.boolean().optional(),
  selectable: z.boolean(),
  striped: z.boolean().optional(),
  bulkActions: z.array(actionDescriptor),
  headerActions: z.array(actionDescriptor).optional(),
  emptyState: z
    .object({
      heading: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
      action: actionDescriptor.optional(),
    })
    .optional(),
  layout: z.enum(['table', 'grid']),
  gridColumns: z
    .object({
      default: z.number().optional(),
      md: z.number().optional(),
      xl: z.number().optional(),
    })
    .optional(),
})
export type TableDescriptor = z.infer<typeof tableDescriptor>
export const relationDescriptor = z.object({
  key: z.string(),
  relation: z.string(),
  label: z.string(),
  group: z.string().optional(),
  icon: z.string().optional(),
  badge: z.union([z.string(), z.number()]).optional(),
  url: z.string(),
  dataProp: z.string(),
  queryPrefix: z.string(),
  readOnly: z.boolean(),
  table: tableDescriptor,
  actions: z.object({
    header: z.array(actionDescriptor),
    row: z.array(actionDescriptor),
    bulk: z.array(actionDescriptor),
  }),
})
export type RelationDescriptor = z.infer<typeof relationDescriptor>

export const tableRow = z.object({
  key: z.union([z.string(), z.number()]),
  cells: z.record(z.string(), z.unknown()),
  actions: z.array(actionDescriptor),
  url: z.string().optional(),
  selectable: z.boolean(),
  className: z.string().optional(),
})
export type TableRow = z.infer<typeof tableRow>
export const tableMeta = z.object({
  simple: z.boolean().optional(),
  hasNext: z.boolean().optional(),
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
export const widgetStat = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  /** Full value behind a compact `value` (tooltip). */
  title: z.string().optional(),
  description: z.string().optional(),
  descriptionIcon: z.string().optional(),
  color: z.string().optional(),
  chart: z.array(z.number()).optional(),
})
export const widgetTimelineItem = z.object({
  title: z.string(),
  description: z.string().optional(),
  time: z.object({ iso: z.string(), formatted: z.string() }),
  actor: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  changes: z.array(z.object({ field: z.string(), old: z.unknown(), new: z.unknown() })).optional(),
})
export const widgetData = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stats'), stats: z.array(widgetStat) }),
  z.object({
    kind: z.literal('chart'),
    labels: z.array(z.string()),
    datasets: z.array(
      z.object({ label: z.string(), data: z.array(z.number()), color: z.string().optional() })
    ),
  }),
  z.object({
    kind: z.literal('scatter'),
    datasets: z.array(
      z.object({
        label: z.string(),
        data: z.array(z.object({ x: z.number(), y: z.number() })),
        color: z.string().optional(),
      })
    ),
  }),
  z.object({ kind: z.literal('timeline'), items: z.array(widgetTimelineItem) }),
  z.object({ kind: z.literal('table'), data: tableData }),
  z.object({ kind: z.literal('component'), data: z.unknown() }),
])
export const widgetDescriptor = z.object({
  name: z.string(),
  kind: z.enum(['stats', 'chart', 'table', 'component', 'timeline']),
  dataProp: z.string(),
  dataUrl: z.string().optional(),
  heading: z.string().optional(),
  description: z.string().optional(),
  span: z.union([z.number(), z.literal('full')]),
  sort: z.number(),
  poll: z.number().optional(),
  placement: z.enum(['header', 'footer']).optional(),
  chartType: z.enum(['line', 'bar', 'area', 'pie', 'doughnut', 'radar', 'scatter']).optional(),
  component: z.string().optional(),
  table: tableDescriptor.optional(),
})
export type WidgetTimelineItem = z.infer<typeof widgetTimelineItem>
export type WidgetStat = z.infer<typeof widgetStat>
export type WidgetData = z.infer<typeof widgetData>
export type WidgetDescriptor = z.infer<typeof widgetDescriptor>
export const widgetFilter = z.object({
  name: z.string(),
  label: z.string(),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
})
export type WidgetFilter = z.infer<typeof widgetFilter>

export const formDescriptor = z.object({
  method: z.enum(['get', 'post', 'put', 'patch']),
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
  cloneable: z.boolean().optional(),
  addLabel: z.string().optional(),
  grid: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
  table: z
    .array(
      z.object({
        label: z.string(),
        width: z.string().optional(),
        alignment: z.enum(['start', 'center', 'end']).optional(),
        required: z.boolean().optional(),
      })
    )
    .optional(),
  defaultItems: z.array(z.record(z.string(), z.unknown())).optional(),
})
export const builderDescriptor = z.object({
  name: z.string(),
  blocks: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      icon: z.string().optional(),
      template: z.string(),
    })
  ),
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  reorderable: z.boolean(),
  collapsible: z.boolean(),
  cloneable: z.boolean(),
  addLabel: z.string().optional(),
  blockPickerColumns: z.number().optional(),
})
export type BuilderDescriptor = z.infer<typeof builderDescriptor>
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
  imageEditor: z.boolean().optional(),
  imageEditorAspectRatios: z.array(z.string().nullable()).optional(),
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
export const optionsResponse = z.object({ options: z.array(option), hasMore: z.boolean() })
export type OptionsResponse = z.infer<typeof optionsResponse>

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
  collapsed: z.boolean().optional(),
})
export type NavGroup = z.infer<typeof navGroup>
export const notificationAction = z.object({
  label: z.string(),
  url: z.string().optional(),
  method: z.enum(['get', 'post']).optional(),
  markAsRead: z.boolean().optional(),
})
export const flashMessage = z.object({
  type: z.enum(['success', 'error', 'warning', 'info']),
  title: z.string(),
  body: z.string().optional(),
  actions: z.array(notificationAction).optional(),
})
export type FlashMessage = z.infer<typeof flashMessage>
export const brand = z.object({
  name: z.string(),
  logo: z.string().optional(),
  logoDark: z.string().optional(),
  favicon: z.string().optional(),
})
export type Brand = z.infer<typeof brand>
export const themeVars = z.object({
  primary: z.string().optional(),
  darkMode: z.enum(['light', 'dark', 'system']).optional(),
  radius: z.string().optional(),
  vars: z.record(z.string(), z.string()).optional(),
  fontFamily: z.string().optional(),
  fontUrl: z.string().optional(),
  density: z.enum(['compact', 'comfortable']).optional(),
  sidebar: z.enum(['expanded', 'collapsed', 'top-nav']).optional(),
  sidebarCollapsibleOnDesktop: z.boolean().optional(),
  contentWidth: z
    .enum(['md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full', 'screen'])
    .optional(),
  stylesheet: z.string().optional(),
})
export type ThemeVars = z.infer<typeof themeVars>
export const panelFeatures = z.record(z.string(), z.boolean())
export type PanelFeatures = z.infer<typeof panelFeatures>
export const breadcrumb = z.object({ label: z.string(), url: z.string().optional() })
export type Breadcrumb = z.infer<typeof breadcrumb>
export const subNavigationItem = z.object({
  key: z.string(),
  label: z.string(),
  url: z.string(),
  active: z.boolean().optional(),
})
export type SubNavigationItem = z.infer<typeof subNavigationItem>

export const stateModel = z.record(z.string(), z.unknown())
export type StateModel = z.infer<typeof stateModel>
export const jsonPatchOp = z.discriminatedUnion('op', [
  z.object({ op: z.enum(['add', 'replace', 'test']), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal('remove'), path: z.string() }),
  z.object({ op: z.enum(['move', 'copy']), path: z.string(), from: z.string() }),
])
export type JsonPatchOp = z.infer<typeof jsonPatchOp>
export const patchResponse = z.object({ patch: z.array(jsonPatchOp) })
export const evaluateResponse = z.object({ set: z.record(z.string(), z.unknown()) })
export type EvaluateResponse = z.infer<typeof evaluateResponse>
export const actionResult = z.object({
  flash: z.array(flashMessage),
  redirect: z.string().optional(),
  reload: z.boolean().optional(),
  patch: z.array(jsonPatchOp).optional(),
  deselect: z.boolean().optional(),
})
export type ActionResult = z.infer<typeof actionResult>
export type PatchResponse = z.infer<typeof patchResponse>

export const elementSchema = z.object({
  // Hosts may extend the catalog; client registries reject unregistered names.
  type: z.string().min(1),
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
  uploadOwner: z.object({ resource: z.string(), record: z.string().optional() }).optional(),
  catalogExtensions: z
    .array(z.object({ name: z.string(), components: z.array(z.string()) }))
    .optional(),
})
export type ActionFormResponse = z.infer<typeof actionFormResponse>

export const userMenuItem = z.object({
  label: z.string(),
  url: z.string(),
  icon: z.string().optional(),
  method: z.enum(['get', 'post']).optional(),
  external: z.boolean().optional(),
})
export type UserMenuItem = z.infer<typeof userMenuItem>
export const tenantSummary = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  slug: z.string().optional(),
})
export const tenantOption = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  /** mode `url`: tenant home URL (GET); mode `implicit`: switch endpoint (POST `{ tenant: id }`). */
  url: z.string(),
  method: z.enum(['get', 'post']).optional(),
  current: z.boolean().optional(),
})
export type TenantOption = z.infer<typeof tenantOption>
export const notificationsProp = z.object({
  unread: z.number(),
  /** `GET` inbox endpoint (`/_pupitre/notifications`). */
  url: z.string(),
  /** `POST` mark-read endpoint (`/_pupitre/notifications/read`). */
  readUrl: z.string(),
  /** Polling interval in ms (`router.reload({ only: ['pupitre'] })`). */
  interval: z.number(),
})
export const notificationItem = z.object({
  id: z.string(),
  type: z.enum(['success', 'error', 'warning', 'info']),
  title: z.string(),
  body: z.string().optional(),
  url: z.string().optional(),
  actions: z.array(notificationAction).optional(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
})
export type NotificationItem = z.infer<typeof notificationItem>
export const notificationListResponse = z.object({
  items: z.array(notificationItem),
  unread: z.number(),
  meta: z.object({
    total: z.number(),
    perPage: z.number(),
    currentPage: z.number(),
    lastPage: z.number(),
  }),
})
export const notificationsReadRequest = z.object({
  ids: z.union([z.array(z.string()), z.literal('all')]),
})
export const exportJobResponse = z.object({
  jobId: z.string(),
  progressUrl: z.string(),
  downloadUrl: z.string(),
})
export const importJobResponse = z.object({
  jobId: z.string(),
  progressUrl: z.string(),
})
export type ImportJobResponse = z.infer<typeof importJobResponse>
export const exportProgressResponse = z.object({
  id: z.string(),
  status: z.enum(['queued', 'processing', 'done', 'failed']),
  totalRows: z.number(),
  processedRows: z.number(),
  error: z.string().optional(),
  downloadUrl: z.string().optional(),
  createdRows: z.number().optional(),
  updatedRows: z.number().optional(),
  failedRows: z.number().optional(),
  failedRowsUrl: z.string().optional(),
})
export type ExportJobResponse = z.infer<typeof exportJobResponse>
export type ExportProgressResponse = z.infer<typeof exportProgressResponse>
export const importPreviewResponse = z.object({
  headers: z.array(z.string()),
  preview: z.array(z.record(z.string(), z.string())),
  fields: z.array(z.object({ name: z.string(), label: z.string(), required: z.boolean() })),
})
export const importResultResponse = z.object({
  total: z.number(),
  created: z.number(),
  updated: z.number(),
  failed: z.number(),
  failedRowsUrl: z.string().optional(),
})
export type ImportPreviewResponse = z.infer<typeof importPreviewResponse>
export type ImportResultResponse = z.infer<typeof importResultResponse>
export const globalSearchResult = z.object({
  title: z.string(),
  details: z.array(z.string()).optional(),
  url: z.string(),
})
export const globalSearchGroup = z.object({
  resource: z.string(),
  label: z.string(),
  results: z.array(globalSearchResult),
})
export const globalSearchResponse = z.object({ groups: z.array(globalSearchGroup) })
export type GlobalSearchResponse = z.infer<typeof globalSearchResponse>
export const pageProps = z
  .object({
    pupitre: z.object({
      impersonation: z.object({ name: z.string(), leaveUrl: z.string() }).optional(),
      environment: z
        .object({
          label: z.string(),
          color: z.enum(['primary', 'success', 'warning', 'danger', 'info', 'gray']),
        })
        .optional(),
      panel: z.object({
        id: z.string(),
        path: z.string(),
        brand,
        theme: themeVars,
        features: panelFeatures,
        logoutUrl: z.string().optional(),
        profileUrl: z.string().optional(),
        userMenu: z.array(userMenuItem).optional(),
        search: z.object({ url: z.string(), keyBinding: z.string() }).optional(),
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
      tenant: tenantSummary.nullable(),
      tenants: z.array(tenantOption).optional(),
      nav: z.array(navGroup),
      flash: z.array(flashMessage),
      notifications: notificationsProp.optional(),
      realtime: z.object({ driver: z.string(), userChannel: z.string() }).optional(),
      locale: z.string(),
      locales: z.array(z.string()).optional(),
      messages: z
        .record(
          z.string(),
          z.union([
            z.string(),
            z.object({ one: z.string(), other: z.string(), zero: z.string().optional() }),
          ])
        )
        .optional(),
      timezone: z.string(),
      /** BCP 47 locale for number and money separators on the client. */
      numberLocale: z.string().optional(),
    }),
    page: z.object({
      key: z.string(),
      kind: z.enum(['list', 'create', 'edit', 'view', 'page', 'dashboard', 'auth', 'custom']),
      title: z.string(),
      breadcrumbs: z.array(breadcrumb),
      spec: jsonRenderSpec,
      state: stateModel,
      actions: z.object({ header: z.array(actionDescriptor) }),
      widgets: z.array(widgetDescriptor).optional(),
      filters: z.array(widgetFilter).optional(),
      relations: z.array(relationDescriptor).optional(),
      subNavigation: z.array(subNavigationItem).optional(),
      clusterNavigation: z.array(subNavigationItem).optional(),
      clusterNavigationPosition: z.enum(['start', 'top']).optional(),
      deferred: z.array(z.string()).optional(),
      catalogVersion: z.string(),
      catalogExtensions: z
        .array(z.object({ name: z.string(), components: z.array(z.string()) }))
        .optional(),
      component: z.string().optional(),
    }),
    data: z.union([tableData, z.record(z.string(), z.unknown())]).optional(),
  })
  .catchall(z.unknown())
export type PupitrePageProps = z.infer<typeof pageProps>

export const expressionProp = dynamic(z.unknown())
