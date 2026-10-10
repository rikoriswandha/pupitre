import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import type { PolicyClass } from '../definition/resource.js'
import { E_PUPITRE_FORBIDDEN } from '../errors.js'
import type { PupitreConfig } from '../define_config.js'

const warnedResources = new Set<string>()

type BouncerContext = HttpContext & {
  bouncer?: {
    with(policy: PolicyClass): { allows(ability: string, record?: LucidRow): Promise<boolean> }
  }
}

async function policyFor(
  resource: ResourceRuntime,
  config?: PupitreConfig
): Promise<PolicyClass | undefined> {
  const configured = resource.definition.policy
  if (typeof configured === 'function' && !('prototype' in configured)) {
    const loadPolicy = configured as () => Promise<{ default: PolicyClass }>
    const module = await loadPolicy()
    return module.default
  }
  if (configured) return configured as PolicyClass
  const policies = await config?.policies?.()
  const modelName = resource.definition.model.replace(/Model$/, '')
  const candidate = policies?.[`${modelName}Policy`] ?? policies?.[resource.definition.model]
  if (typeof candidate === 'function') return candidate as PolicyClass
  if (candidate && typeof candidate === 'object' && 'default' in candidate) {
    const policy = candidate.default
    if (typeof policy === 'function') return policy as PolicyClass
  }
  return undefined
}

export async function authorizeResource(
  ctx: HttpContext,
  resource: ResourceRuntime,
  ability: 'viewAny' | 'view' | 'create' | 'update' | 'delete' | string,
  record?: LucidRow
): Promise<boolean> {
  const bouncerContext = ctx as BouncerContext
  const config = (await app.container.make('pupitre.config').catch(() => undefined)) as
    PupitreConfig | undefined
  const policy = await policyFor(resource, config)
  if (!policy || !bouncerContext.bouncer) {
    const identity = `${resource.definition.model}:${resource.slug}`
    if (!warnedResources.has(identity)) {
      warnedResources.add(identity)
      ctx.logger
        .child({ module: 'pupitre' })
        .warn(
          `No authorization policy or Bouncer context for resource "${resource.slug}"; allowing access`
        )
    }
    return true
  }
  const bouncer = bouncerContext.bouncer as unknown as {
    with(policy: PolicyClass): { allows(ability: string, record?: LucidRow): Promise<boolean> }
  }
  return bouncer.with(policy).allows(ability, record)
}

export async function ensureAuthorized(
  ctx: HttpContext,
  resource: ResourceRuntime,
  ability: 'viewAny' | 'view' | 'create' | 'update' | 'delete' | string,
  record?: LucidRow
): Promise<void> {
  if (!(await authorizeResource(ctx, resource, ability, record))) throw new E_PUPITRE_FORBIDDEN()
}
