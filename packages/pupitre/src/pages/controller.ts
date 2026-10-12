import { consumeFormUploads } from '../storage/upload_tracking.js'
import type { HttpContext } from '@adonisjs/core/http'
import type { PageRuntime } from '../manager.js'
import { compileForm } from '../compiler/schema_compiler.js'
import {
  compileActionDescriptor,
  compileActionForm,
  executeAction,
} from '../compiler/action_compiler.js'
import { compileValidator } from '../compiler/vine_compiler.js'
import { prepareWidgets } from '../widgets/controller.js'
import { buildPanelPageProps, pageKey, panelBreadcrumb } from '../http/page_props.js'
import { actionJson, errorJson, setPupitreFlash } from '../http/responses.js'
import { currentPageUrl } from '../http/return_url.js'
import { authorizeAbility } from '../authz/bouncer.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import { t } from '../i18n.js'

function pageFor(ctx: HttpContext): PageRuntime | undefined {
  return ctx.pupitre.panel.pages.find((page) => page.slug === ctx.params.slug)
}

async function ensureCanAccess(ctx: HttpContext, page: PageRuntime): Promise<void> {
  if (page.definition.canAccess && !(await page.definition.canAccess(ctx)))
    throw new E_PUPITRE_FORBIDDEN()
}

function pageCompileContext(ctx: HttpContext) {
  return {
    ctx,
    locale: ctx.pupitre.locale,
    timezone: ctx.pupitre.timezone,
    resourceSlug: ctx.params.slug,
    uploadUrls: {
      upload: `${ctx.pupitre.panel.path}/_pupitre/upload`,
      delete: `${ctx.pupitre.panel.path}/_pupitre/upload`,
    },
  }
}

async function renderPage(ctx: HttpContext, page: PageRuntime) {
  const definition = page.definition
  await ensureCanAccess(ctx, page)
  const compiled = await compileForm(definition.form ?? [], {
    ...pageCompileContext(ctx),
    form: {
      method: 'post',
      url: page.url,
      submitLabel: t('Save'),
      dirtyGuard: Boolean(definition.form && definition.save),
    },
    ...(definition.form ? { data: (await definition.fill?.(ctx)) ?? {} } : {}),
  })
  if (!definition.form) {
    const root = compiled.spec.elements[compiled.spec.root]!
    root.type = 'Fragment'
    root.props = {}
  }
  const actions = await Promise.all(
    definition.actions.map((action) =>
      compileActionDescriptor(action, {
        baseUrl: page.url,
        ctx,
        authorize: async (ability) => {
          await ensureCanAccess(ctx, page)
          if (!ability) return true
          return authorizeAbility(ctx, ability)
        },
        routes: {
          list: page.url,
          create: page.url,
          edit: () => page.url,
          view: () => page.url,
          destroy: () => page.url,
        },
      })
    )
  )
  const prepared = await prepareWidgets(ctx, definition.widgets ?? [], undefined, undefined, {
    customPage: page.slug,
  })
  const props = buildPanelPageProps({
    ctx,
    key: pageKey(ctx, page.slug, 'page'),
    kind: definition.component ? 'custom' : 'page',
    title: definition.title,
    breadcrumbs: [panelBreadcrumb(ctx), { label: definition.title }],
    spec: compiled.spec,
    state: compiled.state,
    headerActions: actions,
    widgets: prepared.widgets,
    deferred: prepared.deferred,
    filters: definition.filters,
    extraProps: prepared.extraProps,
    ...(definition.component ? { component: definition.component } : {}),
  })
  return ctx.inertia.render((definition.component ?? 'pupitre') as never, props as never)
}

export default class CustomPageController {
  async show(ctx: HttpContext) {
    const page = pageFor(ctx)
    if (!page) return ctx.response.notFound()
    return renderPage(ctx, page)
  }

  async store(ctx: HttpContext) {
    const page = pageFor(ctx)
    if (!page?.definition.form || !page.definition.save) return ctx.response.notFound()
    await ensureCanAccess(ctx, page)
    try {
      const payload = ctx.request.input('data') ?? ctx.request.all()
      const data = await compileValidator(page.definition.form).validate(payload, {
        ctx,
        timezone: ctx.pupitre.timezone,
      })
      await consumeFormUploads(ctx, page.slug, page.definition.form, data)
      await page.definition.save({ data, ctx })
      if (ctx.request.accepts(['json', 'html']) !== 'json')
        setPupitreFlash(ctx, [{ type: 'success', title: t('Saved successfully') }])
      return ctx.response.redirect(page.url)
    } catch (error) {
      if (
        error instanceof E_PUPITRE_FORBIDDEN ||
        (error as { code?: string })?.code === 'E_PUPITRE_FORBIDDEN'
      )
        throw error
      if ((error as { status?: number })?.status === 422) {
        if (ctx.request.accepts(['json', 'html']) !== 'json') throw error
        const errors: Record<string, string[]> = {}
        for (const message of (error as { messages?: { field?: string; message: string }[] })
          .messages ?? []) {
          const field = message.field ?? '_form'
          ;(errors[field] ??= []).push(message.message)
        }
        return errorJson(ctx, t('The submitted data is invalid'), 422, errors)
      }
      throw error
    }
  }

  async showAction(ctx: HttpContext) {
    const page = pageFor(ctx)
    if (!page) return errorJson(ctx, t('Page not found'), 404)
    await ensureCanAccess(ctx, page)
    const action = page.definition.actions.find((item) => item.name === ctx.params.action)
    if (!action) return errorJson(ctx, t('Action not found'), 404)
    const url = `${page.url}/actions/${action.name}`
    const authorize = (ability: string) => authorizeAbility(ctx, ability)
    const descriptor = await compileActionDescriptor(action, {
      baseUrl: page.url,
      ctx,
      authorize,
      routes: {
        list: page.url,
        create: page.url,
        edit: () => page.url,
        view: () => page.url,
        destroy: () => page.url,
      },
    })
    if (!descriptor.enabled)
      return errorJson(ctx, t('You are not authorized to perform this action'), 403)
    if (!action.form) return errorJson(ctx, t('This action does not define a form'), 404)
    return ctx.response.json(await compileActionForm(action, { ...pageCompileContext(ctx), url }))
  }

  async runAction(ctx: HttpContext) {
    const page = pageFor(ctx)
    if (!page) return errorJson(ctx, t('Page not found'), 404)
    await ensureCanAccess(ctx, page)
    const action = page.definition.actions.find((item) => item.name === ctx.params.action)
    if (!action) return errorJson(ctx, t('Action not found'), 404)
    const currentUrl = currentPageUrl(ctx, page.url)
    try {
      const result = await executeAction(action, {
        ctx,
        data: ctx.request.input('data') ?? {},
        beforeHandle: action.form
          ? (data) => consumeFormUploads(ctx, page.slug, [...action.form!], data)
          : undefined,
        authorize: (ability) => authorizeAbility(ctx, ability),
        currentUrl,
        listUrl: page.url,
      })
      return actionJson(ctx, result)
    } catch (error) {
      if (
        error instanceof E_PUPITRE_FORBIDDEN ||
        (error as { code?: string })?.code === 'E_PUPITRE_FORBIDDEN'
      )
        return errorJson(ctx, t('You are not authorized to perform this action'), 403)
      if ((error as { status?: number })?.status === 422) {
        const errors: Record<string, string[]> = {}
        for (const message of (error as { messages?: { field?: string; message: string }[] })
          .messages ?? []) {
          const field = message.field ?? '_form'
          ;(errors[field] ??= []).push(message.message)
        }
        return errorJson(ctx, t('The submitted data is invalid'), 422, errors)
      }
      throw error
    }
  }
}
