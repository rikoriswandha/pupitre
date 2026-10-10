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

import { t } from '../i18n.js'

export type PupitrePageKind = 'list' | 'create' | 'edit' | 'view' | 'custom'

export function buildPageProps(options: {
  ctx: HttpContext
  resource: ResourceRuntime
  kind: PupitrePageKind
  spec: JsonRenderSpec
  state: StateModel
  title: string
  recordId?: string | number
  recordLabel?: string
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
    recordLabel,
    headerActions = [],
    data,
    component,
  } = options
  const page = {
    key: `${ctx.pupitre.panel.id}:${resource.slug}:${kind}:${recordId ?? ''}:`,
    kind: component ? ('custom' as const) : kind,
    title,
    breadcrumbs: ctx.pupitre.panel.breadcrumbs
      ? [
          {
            label: t(ctx.pupitre.panel.brand?.name ?? ctx.pupitre.panel.id),
            url: ctx.pupitre.panel.path,
          },
          { label: t(resource.pluralLabel), url: resource.urls.list },
          ...(recordId === undefined ? [] : [{ label: t(recordLabel ?? String(recordId)) }]),
          ...(kind === 'create' ? [{ label: t('Create') }] : []),
          ...(kind === 'edit' ? [{ label: t('Edit') }] : []),
          ...(kind === 'view' ? [{ label: t('View') }] : []),
        ]
      : [],
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
