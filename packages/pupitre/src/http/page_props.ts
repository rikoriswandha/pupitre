import app from '@adonisjs/core/services/app'
import { catalogVersion, pageProps } from '../../catalog/index.js'
import type {
  JsonRenderSpec,
  StateModel,
  ActionDescriptor,
  TableData,
} from '../../catalog/index.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { ResourceRuntime } from '../manager.js'

export type PupitrePageKind = 'list' | 'create' | 'edit' | 'view' | 'custom'

export function buildPageProps(options: {
  ctx: HttpContext
  resource: ResourceRuntime
  kind: PupitrePageKind
  spec: JsonRenderSpec
  state: StateModel
  title: string
  recordId?: string | number
  headerActions?: ActionDescriptor[]
  data?: TableData | Record<string, unknown>
  component?: string
}) {
  const {
    ctx,
    resource,
    kind,
    spec,
    state,
    title,
    recordId,
    headerActions = [],
    data,
    component,
  } = options
  const page = {
    key: `${ctx.pupitre.panel.id}:${resource.slug}:${kind}:${recordId ?? ''}:`,
    kind: component ? ('custom' as const) : kind,
    title,
    breadcrumbs: [
      { label: ctx.pupitre.panel.brand?.name ?? ctx.pupitre.panel.id, url: ctx.pupitre.panel.path },
      { label: resource.pluralLabel, url: resource.urls.list },
      ...(recordId === undefined ? [] : [{ label: String(recordId) }]),
      ...(kind === 'create' ? [{ label: 'Create' }] : []),
      ...(kind === 'edit' ? [{ label: 'Edit' }] : []),
      ...(kind === 'view' ? [{ label: 'View' }] : []),
    ],
    spec,
    state,
    actions: { header: headerActions },
    catalogVersion,
    ...(component ? { component } : {}),
  }
  const props = { page, ...(data === undefined ? {} : { data }) }
  if (!app.inProduction)
    pageProps.parse({
      pupitre: {
        panel: {
          id: ctx.pupitre.panel.id,
          path: ctx.pupitre.panel.path,
          brand: ctx.pupitre.panel.brand ?? { name: ctx.pupitre.panel.id },
          theme: ctx.pupitre.panel.theme ?? {},
          features: {},
        },
        user: ctx.pupitre.user,
        tenant: null,
        nav: [],
        flash: [],
        locale: ctx.pupitre.locale,
        timezone: ctx.pupitre.timezone,
      },
      ...props,
    })
  return props
}
