import type { HttpContext } from '@adonisjs/core/http'
import type { SchemaNodeDefinition } from '../definition/schema.js'
import { ensureAuthorized } from '../authz/bouncer.js'
import type { ResourceRuntime, PageRuntime } from '../manager.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'

export type FormOwner =
  | {
      kind: 'resource'
      form: SchemaNodeDefinition[]
      authorize(ability: 'create' | 'update'): Promise<void>
    }
  | {
      kind: 'page'
      form: SchemaNodeDefinition[]
      authorize(ability: 'create' | 'update'): Promise<void>
    }

export function findFormOwner(ctx: HttpContext, slug: string): FormOwner | undefined {
  const panel = ctx.pupitre.panel
  const resource = panel.resources.find((item: ResourceRuntime) => item.slug === slug)
  if (resource?.definition.form) {
    return {
      kind: 'resource',
      form: resource.definition.form,
      authorize: (ability) => ensureAuthorized(ctx, resource, ability),
    }
  }
  const page = panel.pages.find((item: PageRuntime) => item.slug === slug)
  if (!page?.definition.form) return undefined
  return {
    kind: 'page',
    form: page.definition.form,
    authorize: async (_ability) => {
      if (page.definition.canAccess && !(await page.definition.canAccess(ctx)))
        throw new E_PUPITRE_FORBIDDEN()
    },
  }
}
