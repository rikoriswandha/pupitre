import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../../manager.js'
import { ensureAuthorized } from '../../authz/bouncer.js'
import { E_PUPITRE_NOT_FOUND } from '../../errors.js'
import { requestResource, scopedQuery } from '../../query/scoped_query.js'

function keyName(model: LucidModel): string {
  const modelWithPrimaryKey = model as LucidModel & { primaryKey?: string }
  return modelWithPrimaryKey.primaryKey ?? 'id'
}

const nestedParents = new WeakMap<HttpContext, LucidRow>()

export async function authorizeNestedParent(
  ctx: HttpContext,
  resource: ResourceRuntime,
  mutation = false
): Promise<LucidRow | undefined> {
  if (!resource.parent) return undefined
  const parentResource = requestResource(ctx, resource.parent.resource)
  if (!parentResource) throw new E_PUPITRE_NOT_FOUND()
  await ensureAuthorized(ctx, parentResource, 'viewAny')
  const parent = await scopedQuery(ctx, parentResource)
    .where(keyName(parentResource.model), ctx.params[resource.parent.param])
    .first()
  if (!parent) throw new E_PUPITRE_NOT_FOUND()
  await ensureAuthorized(ctx, parentResource, 'view', parent)
  if (mutation) await ensureAuthorized(ctx, parentResource, 'update', parent)
  nestedParents.set(ctx, parent)
  return parent
}

export function applyNestedOwnership(
  ctx: HttpContext,
  resource: ResourceRuntime,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!resource.parent) return data
  const parent = nestedParents.get(ctx)
  const parentResource = requestResource(ctx, resource.parent.resource)
  if (!parent || !parentResource) throw new E_PUPITRE_NOT_FOUND()
  const relation = resource.model.$getRelation(resource.parent.relation)
  relation.boot()
  if (relation.type !== 'belongsTo') throw new E_PUPITRE_NOT_FOUND()
  const belongsTo = relation as typeof relation & { foreignKey: string }
  return {
    ...data,
    [belongsTo.foreignKey]: parent.$getAttribute(keyName(parentResource.model)),
  }
}
