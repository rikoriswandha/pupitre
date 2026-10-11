import { Bouncer } from '@adonisjs/bouncer'
import appService from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { ApplicationService } from '@adonisjs/core/types'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { ActionResult, JsonRenderSpec } from '../catalog/wire.js'
import { E_PUPITRE_FORBIDDEN } from '../src/errors.js'
import { bindPanel } from '../src/manager.js'
import type PupitreManager from '../src/manager.js'
import type { ResourceRuntime } from '../src/manager.js'
import { userSummary } from '../src/http/middleware/pupitre_context.js'
import TenancyResolverMiddleware from '../src/http/middleware/tenancy_resolver.js'
import ResourceController from '../src/http/controllers/resource_controller.js'
import ActionController from '../src/http/controllers/action_controller.js'
import CustomPageController from '../src/pages/controller.js'
import type { ResolvedTenant } from '../src/definition/tenancy.js'
import { actionResult, jsonRenderSpec } from '../catalog/wire.js'

function equal(actual: unknown, expected: unknown): boolean {
  return Object.is(actual, expected)
}

function lookup(state: unknown, path: string): unknown {
  const normalized = path.replace(/^\//, '').replaceAll('/', '.')
  let value = state
  for (const part of normalized.split('.').filter(Boolean)) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

function evaluate(visibility: unknown, state: unknown): boolean {
  if (typeof visibility === 'boolean') return visibility
  if (Array.isArray(visibility)) return visibility.every((item) => evaluate(item, state))
  if (!visibility || typeof visibility !== 'object') return true
  const expression = visibility as Record<string, unknown>
  if (Array.isArray(expression.$and)) return expression.$and.every((item) => evaluate(item, state))
  if (Array.isArray(expression.$or)) return expression.$or.some((item) => evaluate(item, state))
  if (typeof expression.$state !== 'string') return true
  const actual = lookup(state, expression.$state)
  let result = true
  if ('eq' in expression) result = result && equal(actual, expression.eq)
  if ('neq' in expression) result = result && !equal(actual, expression.neq)
  if (typeof expression.gt === 'number')
    result = result && typeof actual === 'number' && actual > expression.gt
  if (typeof expression.gte === 'number')
    result = result && typeof actual === 'number' && actual >= expression.gte
  if (typeof expression.lt === 'number')
    result = result && typeof actual === 'number' && actual < expression.lt
  if (typeof expression.lte === 'number')
    result = result && typeof actual === 'number' && actual <= expression.lte
  return expression.not === true ? !result : result
}
export type SpecExpectation = {
  type: string
  name?: string
  props?: Record<string, unknown>
}

export function assertSpecHas(spec: JsonRenderSpec, expected: SpecExpectation): void {
  const match = Object.entries(spec.elements).find(([name, element]) => {
    if (element.type !== expected.type || (expected.name !== undefined && name !== expected.name))
      return false
    return Object.entries(expected.props ?? {}).every(([key, value]) =>
      equal(element.props[key], value)
    )
  })
  if (!match) {
    throw new Error(
      `Expected spec to contain ${expected.type}${expected.name ? ` named ${expected.name}` : ''}${expected.props ? ` with props ${JSON.stringify(expected.props)}` : ''}`
    )
  }
}

export function assertVisible(spec: JsonRenderSpec, state: unknown, field: string): void {
  const element = spec.elements[field]
  if (!element) throw new Error(`No spec element named "${field}"`)
  if (!evaluate(element.visible, state)) throw new Error(`Expected "${field}" to be visible`)
}

export function assertHidden(spec: JsonRenderSpec, state: unknown, field: string): void {
  const element = spec.elements[field]
  if (!element) throw new Error(`No spec element named "${field}"`)
  if (evaluate(element.visible, state)) throw new Error(`Expected "${field}" to be hidden`)
}

type User = LucidRow
export type HelperOptions = {
  app?: ApplicationService
  user: User
  tenant?: ResolvedTenant
  panel?: string
  query?: Record<string, unknown>
  record?: LucidRow | string | number
}
type RequestInput = {
  data?: Record<string, unknown>
  ids?: Array<string | number>
  query?: Record<string, unknown>
  url: string
  actionRequest?: boolean
}
type CapturedResponse = {
  status: number
  body?: unknown
  redirect?: string
  component?: string
  props?: Record<string, unknown>
}
async function createContext(
  options: HelperOptions,
  input: RequestInput
): Promise<{ ctx: HttpContext; output: CapturedResponse }> {
  const app = options.app ?? appService
  const testUtils = await app.container.make('testUtils')
  const ctx = await testUtils.createHttpContext()
  const manager = (await app.container.make('pupitre.manager')) as PupitreManager
  const panel = manager.getPanel(options.panel ?? 'admin')
  if (!panel) throw new Error(`Unknown Pupitre panel "${options.panel ?? 'admin'}"`)
  const config = await app.container.make('pupitre.config')
  const output: CapturedResponse = { status: 200 }
  const request = {
    all: () => input.data ?? {},
    qs: () => input.query ?? {},
    input: (key: string, fallback?: unknown) => {
      if (key === 'data') return input.data ?? fallback
      if (key === 'ids') return input.ids ?? fallback
      return fallback
    },
    header: (name: string) =>
      name.toLowerCase() === 'x-pupitre-action' && input.actionRequest ? '1' : undefined,
    accepts: () => 'json',
    url: () => input.url,
    ip: () => '127.0.0.1',
  }
  const response = {
    status(code: number) {
      output.status = code
      return response
    },
    json(body: unknown) {
      output.body = body
      return response
    },
    redirect(location?: string) {
      output.redirect = location
      output.status = 302
      return response
    },
    notFound() {
      output.status = 404
      return response
    },
  }
  Object.defineProperty(ctx, 'request', { configurable: true, value: request })
  Object.defineProperty(ctx, 'response', { configurable: true, value: response })
  Object.defineProperty(ctx, 'params', { configurable: true, value: {} })
  Object.defineProperty(ctx, 'inertia', {
    configurable: true,
    value: {
      render: (component: string, props: Record<string, unknown>) => {
        output.component = component
        output.props = props
        return output
      },
      defer: (compute: () => unknown) => ({
        group: 'default',
        rescue: false,
        compute,
      }),
    },
  })
  Object.defineProperty(ctx, 'session', {
    configurable: true,
    value: { get: () => undefined, put() {}, flash() {} },
  })
  const auth = { user: options.user, use: () => ({ user: options.user }) }
  Object.defineProperty(ctx, 'auth', { configurable: true, value: auth })
  const bouncer = new Bouncer(() => options.user, undefined, {}).setContainerResolver(
    ctx.containerResolver
  )
  Object.defineProperty(ctx, 'bouncer', { configurable: true, value: bouncer })
  const tenancyPath =
    options.tenant && panel.tenancy?.mode === 'url'
      ? `${panel.path}/${String(options.tenant.slug ?? encodeURIComponent(String(options.tenant.id)))}`
      : panel.path
  const boundPanel = tenancyPath === panel.path ? panel : bindPanel(panel, tenancyPath)
  ctx.pupitre = {
    panel: boundPanel,
    basePath: panel.path,
    locale: panel.locale ?? 'en',
    timezone: panel.timezone ?? config.timezone ?? 'UTC',
    user: userSummary(options.user, config),
    authUser: options.user,
    tenant: options.tenant ?? null,
  }
  if (options.tenant && panel.tenancy) {
    ctx.params.tenant = String(options.tenant.slug ?? options.tenant.id)
    await new TenancyResolverMiddleware().handle(ctx, async () => {})
  }
  return { ctx, output }
}
function resourceFor(ctx: HttpContext, slug: string): ResourceRuntime {
  const resource = ctx.pupitre.panel.resources.find((item) => item.slug === slug)
  if (!resource) throw new Error(`Unknown Pupitre resource "${slug}"`)
  return resource
}

function recordId(
  resource: ResourceRuntime,
  record: HelperOptions['record']
): string | number | undefined {
  if (record === undefined) return undefined
  if (typeof record === 'string' || typeof record === 'number') return record
  const key = resource.model.primaryKey ?? 'id'
  const value = record.$attributes[key]
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function capturedErrors(output: CapturedResponse): Record<string, string[]> {
  if (!output.body || typeof output.body !== 'object' || !('errors' in output.body)) return {}
  const errors = output.body.errors
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return {}
  return Object.fromEntries(
    Object.entries(errors).flatMap(([field, messages]) =>
      Array.isArray(messages) && messages.every((message) => typeof message === 'string')
        ? [[field, messages]]
        : []
    )
  )
}

export type FormResult = {
  status: number
  errors: Record<string, string[]>
  record?: LucidRow
  assertErrors(expected: Record<string, string>): FormResult
  assertOk(): FormResult
}

function formResult(output: CapturedResponse, record?: LucidRow): FormResult {
  const errors = capturedErrors(output)
  const result: FormResult = {
    status: output.status,
    errors,
    ...(record ? { record } : {}),
    assertErrors(expected) {
      for (const [field, expectedError] of Object.entries(expected)) {
        const messages = errors[field] ?? []
        const expectedToken = expectedError.toLowerCase()
        if (!messages.some((message) => message.toLowerCase().includes(expectedToken))) {
          throw new Error(
            `Expected validation error for "${field}" matching "${expectedError}", received ${JSON.stringify(messages)}`
          )
        }
      }
      return result
    },
    assertOk() {
      if (output.status >= 400 || Object.keys(errors).length) {
        throw new Error(
          `Expected form submission to succeed, received status ${output.status} and errors ${JSON.stringify(errors)}`
        )
      }
      return result
    },
  }
  return result
}
export type RenderedTestingPage = {
  page: unknown
  spec: JsonRenderSpec
  state: unknown
  data: unknown
}

function renderedPage(output: CapturedResponse, slug: string): RenderedTestingPage {
  const props = output.props ?? {}
  const page = props.page
  if (!page || typeof page !== 'object' || Array.isArray(page) || !('spec' in page))
    throw new Error(`Unable to render Pupitre page "${slug}"`)
  return {
    page,
    spec: jsonRenderSpec.parse(page.spec),
    state: 'state' in page ? page.state : undefined,
    data: props.data,
  }
}

export async function visitResource(
  slug: string,
  page: 'list' | 'create' | 'edit' | 'view',
  options: HelperOptions
): Promise<RenderedTestingPage> {
  const { ctx, output } = await createContext(options, { query: options.query, url: `/${slug}` })
  const resource = resourceFor(ctx, slug)
  ctx.params.slug = slug
  const id = recordId(resource, options.record)
  if (id !== undefined) ctx.params.id = String(id)
  const controller = await ctx.containerResolver.make(ResourceController)
  await controller[page](ctx)
  if (output.status >= 400)
    throw new Error(`Unable to visit ${slug} ${page}: HTTP ${output.status}`)
  return renderedPage(output, `${slug}/${page}`)
}

export async function submitForm(
  slug: string,
  mode: 'create' | 'edit',
  data: Record<string, unknown>,
  options: HelperOptions
): Promise<FormResult> {
  const { ctx, output } = await createContext(options, {
    data,
    url: `/${slug}`,
    actionRequest: true,
  })
  const resource = resourceFor(ctx, slug)
  ctx.params.slug = slug
  const id = recordId(resource, options.record)
  if (mode === 'edit' && id === undefined)
    throw new Error('submitForm edit mode requires options.record')
  if (id !== undefined) ctx.params.id = String(id)
  const controller = await ctx.containerResolver.make(ResourceController)
  await controller[mode === 'create' ? 'store' : 'update'](ctx)
  let record: LucidRow | undefined
  if (output.status < 400) {
    const body = output.body
    const redirect =
      body && typeof body === 'object' && 'redirect' in body && typeof body.redirect === 'string'
        ? body.redirect
        : output.redirect
    const segments = redirect?.split('/').filter(Boolean) ?? []
    const savedId = id ?? segments.at(-2)
    if (savedId !== undefined) {
      const key = resource.model.primaryKey ?? 'id'
      record = (await resource.model.query().where(key, savedId).first()) ?? undefined
    }
  }
  return formResult(output, record)
}

export type ActionHelperResult = ActionResult & { errors?: Record<string, string[]> }

export async function runAction(
  slug: string,
  name: string,
  options: HelperOptions & { ids?: Array<string | number>; data?: Record<string, unknown> }
): Promise<ActionHelperResult> {
  const { ctx, output } = await createContext(options, {
    data: options.data,
    ids: options.ids,
    url: `/${slug}`,
    actionRequest: true,
  })
  const resource = resourceFor(ctx, slug)
  ctx.params.slug = slug
  ctx.params.action = name
  const id = recordId(resource, options.record)
  if (id !== undefined) ctx.params.id = String(id)
  const controller = await ctx.containerResolver.make(ActionController)
  await controller.run(ctx)
  if (output.status === 403) throw new E_PUPITRE_FORBIDDEN()
  if (output.status === 422) return { flash: [], errors: capturedErrors(output) }
  if (output.status >= 400) throw new Error(`Action "${name}" failed with HTTP ${output.status}`)
  return actionResult.parse(output.body)
}

export async function visitPage(
  slug: string,
  options: HelperOptions
): Promise<RenderedTestingPage> {
  const { ctx, output } = await createContext(options, { url: `/${slug}` })
  ctx.params.slug = slug
  const controller = await ctx.containerResolver.make(CustomPageController)
  await controller.show(ctx)
  if (output.status >= 400)
    throw new Error(`Unable to visit custom page ${slug}: HTTP ${output.status}`)
  return renderedPage(output, slug)
}
