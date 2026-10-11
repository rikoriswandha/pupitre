import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import type { FieldDefinitionUnion, SchemaNodeDefinition } from '../definition/schema.js'
import { authorizeModel } from '../authz/bouncer.js'
import { compileForm } from '../compiler/schema_compiler.js'
import { compileValidator } from '../compiler/vine_compiler.js'
import { queryOptions } from './query.js'
import { findFormOwner } from '../pages/form_owner.js'
import type { FormOwner } from '../pages/form_owner.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import { fillTenantOwnership } from '../tenancy/runtime.js'
type SelectField = Extract<FieldDefinitionUnion, { kind: 'select' | 'multiSelect' }>
function fields(
  nodes: SchemaNodeDefinition[],
  parent = ''
): Array<{ path: string; field: SelectField }> {
  const output: Array<{ path: string; field: SelectField }> = []
  for (const node of nodes) {
    if ('children' in node) output.push(...fields(node.children, parent))
    if (node.kind === 'select' || node.kind === 'multiSelect') {
      const path = parent ? `${parent}.${node.name}` : node.name
      output.push({ path, field: node })
    }
    if (node.kind === 'repeater' && Array.isArray(node.schema)) {
      output.push(...fields(node.schema, parent ? `${parent}.${node.name}` : node.name))
    }
  }
  return output
}

function relatedModel(owner: ResourceRuntime, field: SelectField): LucidModel | undefined {
  if (!field.relationship) return undefined
  try {
    return owner.model.$getRelation(field.relationship.name).relatedModel() as LucidModel
  } catch {
    return undefined
  }
}

async function canViewForm(owner: FormOwner | undefined): Promise<boolean> {
  if (!owner) return false
  try {
    await owner.authorize('create')
    return true
  } catch (error) {
    if (!(error instanceof E_PUPITRE_FORBIDDEN)) throw error
  }
  try {
    await owner.authorize('update')
    return true
  } catch (error) {
    if (!(error instanceof E_PUPITRE_FORBIDDEN)) throw error
    return false
  }
}

export default class OptionsController {
  async index(ctx: HttpContext) {
    const slug = String(ctx.params.resource ?? '')
    const fieldPath = String(ctx.params.field ?? '').replaceAll('/', '.')
    const ownerForm = findFormOwner(ctx, slug)
    if (!ownerForm) return ctx.response.notFound()
    if (!(await canViewForm(ownerForm))) throw new E_PUPITRE_FORBIDDEN()
    const owner =
      ownerForm.kind === 'resource'
        ? ctx.pupitre.panel.resources.find((resource) => resource.slug === slug)
        : undefined
    const found = fields(ownerForm.form).find((entry) => entry.path === fieldPath)
    if (!found) return ctx.response.notFound()
    const { field } = found
    const model = owner ? relatedModel(owner, field) : undefined
    if (field.relationship && !model) return ctx.response.notFound()
    if (model && !(await authorizeModel(ctx, model, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
    const selectedRaw = ctx.request.qs().selected
    const selected = Array.isArray(selectedRaw)
      ? selectedRaw
      : selectedRaw === undefined
        ? []
        : [selectedRaw]
    const result = await queryOptions({
      ctx,
      ...(owner ? { owner } : {}),
      field,
      search: String(ctx.request.qs().q ?? ''),
      selected,
      page: Number(ctx.request.qs().page ?? 1),
    })
    return ctx.response.ok(result)
  }

  async createForm(ctx: HttpContext) {
    const slug = String(ctx.params.resource ?? '')
    const ownerForm = findFormOwner(ctx, slug)
    if (!ownerForm) return ctx.response.notFound()
    if (!(await canViewForm(ownerForm))) throw new E_PUPITRE_FORBIDDEN()
    if (ownerForm.kind !== 'resource') return ctx.response.notFound()
    const owner = ctx.pupitre.panel.resources.find((resource) => resource.slug === slug)
    if (!owner) return ctx.response.notFound()
    const entry = fields(ownerForm.form).find(
      (candidate) => candidate.path === String(ctx.params.field ?? '').replaceAll('/', '.')
    )
    if (!entry?.field.createOptionForm?.length) return ctx.response.notFound()
    const model = relatedModel(owner, entry.field)
    if (!model) return ctx.response.notFound()
    if (!(await authorizeModel(ctx, model, 'create'))) throw new E_PUPITRE_FORBIDDEN()
    const compiled = await compileForm(entry.field.createOptionForm, {
      ctx,
      locale: ctx.pupitre.locale,
      timezone: ctx.pupitre.timezone,
      resourceSlug: owner.slug,
      form: { method: 'post', url: ctx.request.url(), submitLabel: 'Create', dirtyGuard: false },
    })
    return ctx.response.ok({
      spec: compiled.spec,
      state: compiled.state,
      catalogVersion: compiled.catalogVersion,
    })
  }

  async store(ctx: HttpContext) {
    const slug = String(ctx.params.resource ?? '')
    const ownerForm = findFormOwner(ctx, slug)
    if (!ownerForm) return ctx.response.notFound()
    if (!(await canViewForm(ownerForm))) throw new E_PUPITRE_FORBIDDEN()
    if (ownerForm.kind !== 'resource') return ctx.response.notFound()
    const owner = ctx.pupitre.panel.resources.find((resource) => resource.slug === slug)
    if (!owner) return ctx.response.notFound()
    const entry = fields(ownerForm.form).find(
      (candidate) => candidate.path === String(ctx.params.field ?? '').replaceAll('/', '.')
    )
    if (!entry?.field.createOptionForm?.length) return ctx.response.notFound()
    const model = relatedModel(owner, entry.field)
    if (!model) return ctx.response.notFound()
    if (!(await authorizeModel(ctx, model, 'create'))) throw new E_PUPITRE_FORBIDDEN()
    const body = ctx.request.body() as { data?: unknown }
    const data =
      body &&
      typeof body === 'object' &&
      body.data &&
      typeof body.data === 'object' &&
      !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {}
    let validated: Record<string, unknown>
    try {
      validated = await compileValidator(entry.field.createOptionForm).validate(data, {
        timezone: ctx.pupitre.timezone,
        record: null,
        model: null,
        ctx,
      })
    } catch (error) {
      const messages =
        error && typeof error === 'object' && 'messages' in error && Array.isArray(error.messages)
          ? (error.messages as { field?: string; message?: string }[])
          : []
      const errors: Record<string, string[]> = {}
      for (const message of messages) {
        if (typeof message.message !== 'string') continue
        const field = message.field ?? '_form'
        ;(errors[field] ??= []).push(message.message)
      }
      if (messages.length === 0) errors._form = ['The submitted data is invalid']
      return ctx.response.status(422).json({ errors })
    }
    let created: unknown
    if (entry.field.createOptionUsing) {
      created = await entry.field.createOptionUsing({ data: validated, ctx, model })
    } else {
      const relatedResource = ctx.pupitre.panel.resources.find(
        (resource) => resource.model === model
      )
      const createData = relatedResource
        ? fillTenantOwnership(ctx, relatedResource, validated)
        : validated
      created = await model.create(createData)
    }
    if (!created || typeof created !== 'object') {
      return ctx.response.status(500).json({ message: 'The related record could not be created' })
    }
    const record = created as LucidRow
    const key = model.primaryKey
    const value = record.$getAttribute(key)
    if (typeof value !== 'string' && typeof value !== 'number') {
      return ctx.response
        .status(500)
        .json({ message: 'The related record has no supported identifier' })
    }
    const label = entry.field.getOptionLabelUsing
      ? await entry.field.getOptionLabelUsing(value, ctx)
      : record.$getAttribute(entry.field.relationship?.titleColumn ?? 'name')
    return ctx.response.ok({ option: { value, label: String(label ?? value) } })
  }
}
