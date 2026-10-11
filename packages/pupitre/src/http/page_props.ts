import app from '@adonisjs/core/services/app'
import { catalogVersion, pageProps } from '../../catalog/index.js'
import type {
  Breadcrumb,
  JsonRenderSpec,
  StateModel,
  ActionDescriptor,
  TableData,
} from '../../catalog/index.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { ResourceRuntime } from '../manager.js'
import { panelFeatures, themeVars } from './middleware/share_props.js'

import { t } from '../i18n.js'

export type PupitrePageKind =
  'list' | 'create' | 'edit' | 'view' | 'page' | 'dashboard' | 'auth' | 'custom'

/**
 * Store key (ARCHITECTURE §8): `${panel}:${owner}:${page}:${recordId}:${tenant}`.
 * The store resets exactly when this changes.
 */
export function pageKey(
  ctx: HttpContext,
  owner: string,
  page: string,
  recordId?: string | number
): string {
  return `${ctx.pupitre.panel.id}:${owner}:${page}:${recordId ?? ''}:${ctx.pupitre.tenant?.id ?? ''}`
}

/** Root breadcrumb pointing at the (request-bound) panel home. */
export function panelBreadcrumb(ctx: HttpContext): Breadcrumb {
  return {
    label: t(ctx.pupitre.panel.brand?.name ?? ctx.pupitre.panel.id),
    url: ctx.pupitre.panel.path,
  }
}

/**
 * Assembles the Inertia `page` (+ optional top-level `data`) props for any
 * Pupitre page kind: resources, custom pages, auth pages.
 */
export function buildPanelPageProps(options: {
  ctx: HttpContext
  key: string
  kind: PupitrePageKind
  title: string
  breadcrumbs: Breadcrumb[]
  spec: JsonRenderSpec
  state: StateModel
  headerActions?: ActionDescriptor[]
  data?: TableData | Record<string, unknown>
  component?: string
}) {
  const { ctx, key, kind, title, spec, state, headerActions = [], data, component } = options
  const page = {
    key,
    kind: component ? ('custom' as const) : kind,
    title,
    breadcrumbs: ctx.pupitre.panel.breadcrumbs ? options.breadcrumbs : [],
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
          theme: themeVars(ctx.pupitre.panel),
          features: panelFeatures(ctx.pupitre.panel),
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

/** Resource page props (list/create/edit/view). */
export function buildPageProps(options: {
  ctx: HttpContext
  resource: ResourceRuntime
  kind: 'list' | 'create' | 'edit' | 'view'
  spec: JsonRenderSpec
  state: StateModel
  title: string
  recordId?: string | number
  recordLabel?: string
  headerActions?: ActionDescriptor[]
  data?: TableData | Record<string, unknown>
  component?: string
}) {
  const { ctx, resource, kind, recordId, recordLabel } = options
  return buildPanelPageProps({
    ...options,
    key: pageKey(ctx, resource.slug, kind, recordId),
    breadcrumbs: [
      panelBreadcrumb(ctx),
      { label: t(resource.pluralLabel), url: resource.urls.list },
      ...(recordId === undefined ? [] : [{ label: t(recordLabel ?? String(recordId)) }]),
      ...(kind === 'create' ? [{ label: t('Create') }] : []),
      ...(kind === 'edit' ? [{ label: t('Edit') }] : []),
      ...(kind === 'view' ? [{ label: t('View') }] : []),
    ],
  })
}
