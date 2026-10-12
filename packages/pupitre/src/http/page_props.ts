import { symbols as inertiaSymbols } from '@adonisjs/inertia'
import app from '@adonisjs/core/services/app'
import { catalogVersion, pageProps } from '../../catalog/index.js'
import type {
  ActionDescriptor,
  Breadcrumb,
  JsonRenderSpec,
  RelationDescriptor,
  StateModel,
  SubNavigationItem,
  TableData,
  WidgetDescriptor,
  WidgetFilter,
} from '../../catalog/index.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { ResourceRuntime } from '../manager.js'
import { panelFeatures, themeVars } from './middleware/share_props.js'

import { collectCatalogExtensions } from '../builder/extensions.js'
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
    label: ctx.pupitre.panel.brand?.name ?? ctx.pupitre.panel.id,
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
  relations?: RelationDescriptor[]
  extraProps?: Record<string, unknown>
  component?: string
  deferred?: string[]
  widgets?: WidgetDescriptor[]
  filters?: WidgetFilter[]
  subNavigation?: SubNavigationItem[]
}) {
  const {
    ctx,
    key,
    kind,
    title,
    spec,
    state,
    headerActions = [],
    data,
    component,
    relations,
    extraProps,
    deferred,
    widgets,
    filters,
    subNavigation,
  } = options
  const page = {
    key,
    kind: component ? ('custom' as const) : kind,
    title,
    breadcrumbs: ctx.pupitre.panel.breadcrumbs ? options.breadcrumbs : [],
    spec,
    state,
    actions: { header: headerActions },
    ...(widgets ? { widgets } : {}),
    ...(filters ? { filters } : {}),
    ...(relations ? { relations } : {}),
    ...(subNavigation ? { subNavigation } : {}),
    ...(deferred ? { deferred } : {}),
    catalogVersion,
    catalogExtensions: collectCatalogExtensions({ spec, relations, widgets }),
    ...(component ? { component } : {}),
  }
  const props = { page, ...(data === undefined ? {} : { data }), ...extraProps }
  if (!app.inProduction) {
    const deferredData =
      data !== null && typeof data === 'object' && inertiaSymbols.DEFERRED_PROP in data
    const propsToValidate = deferredData
      ? Object.fromEntries(Object.entries(props).filter(([propName]) => propName !== 'data'))
      : props
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
      ...propsToValidate,
    })
  }
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
  relations?: RelationDescriptor[]
  extraProps?: Record<string, unknown>
  component?: string
  deferred?: string[]
  widgets?: WidgetDescriptor[]
  parentBreadcrumb?: { label: string; url: string }
  subNavigation?: SubNavigationItem[]
}) {
  const { ctx, resource, kind, recordId, recordLabel } = options
  return buildPanelPageProps({
    ...options,
    key: pageKey(ctx, resource.slug, kind, recordId),
    breadcrumbs: [
      panelBreadcrumb(ctx),
      ...(options.parentBreadcrumb ? [options.parentBreadcrumb] : []),
      { label: resource.pluralLabel, url: resource.urls.list },
      ...(recordId === undefined ? [] : [{ label: recordLabel ?? String(recordId) }]),
      ...(kind === 'create' ? [{ label: t('Create') }] : []),
      ...(kind === 'edit' ? [{ label: t('Edit') }] : []),
      ...(kind === 'view' ? [{ label: t('View') }] : []),
    ],
  })
}
