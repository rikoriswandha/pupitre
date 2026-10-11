import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow } from '@adonisjs/lucid/types/model'
import type { ResourceRuntime } from '../manager.js'
import type { PolicyClass } from '../definition/resource.js'
import { E_PUPITRE_BOUNCER_NOT_INITIALIZED, E_PUPITRE_FORBIDDEN } from '../errors.js'
import type { PupitreConfig } from '../define_config.js'

const warnedResources = new Set<string>()
const configuredPolicyModules = new WeakMap<object, Promise<Record<string, unknown>>>()
const lazyPolicies = new WeakMap<Function, Promise<PolicyClass>>()

async function policiesFor(config?: PupitreConfig): Promise<Record<string, unknown> | undefined> {
  if (!config?.policies) return undefined
  let pending = configuredPolicyModules.get(config)
  if (!pending) {
    pending = config.policies()
    configuredPolicyModules.set(config, pending)
  }
  return pending
}

function isPolicyClass(value: unknown): value is PolicyClass {
  return typeof value === 'function' && 'prototype' in value
}

type BouncerContext = HttpContext & {
  bouncer?: {
    with(policy: PolicyClass): { allows(ability: string, record?: LucidRow): Promise<boolean> }
    allows(ability: string): Promise<boolean>
  }
}

export async function resolveModelPolicy(
  modelName: string,
  config?: PupitreConfig
): Promise<PolicyClass | undefined> {
  const policies = await policiesFor(config)
  const name = modelName.replace(/Model$/, '')
  const candidate = policies?.[`${name}Policy`] ?? policies?.[modelName]
  if (isPolicyClass(candidate)) return candidate
  if (candidate && typeof candidate === 'object' && 'default' in candidate) {
    const policy = candidate.default
    if (isPolicyClass(policy)) return policy
  }
  return undefined
}

export async function resolveResourcePolicy(
  resource: ResourceRuntime,
  config?: PupitreConfig
): Promise<PolicyClass | undefined> {
  const configured = resource.definition.policy
  if (typeof configured === 'function' && !('prototype' in configured)) {
    const loadPolicy = configured as () => Promise<{ default: PolicyClass }>
    let pending = lazyPolicies.get(loadPolicy)
    if (!pending) {
      pending = loadPolicy().then((module) => module.default)
      lazyPolicies.set(loadPolicy, pending)
    }
    return pending
  }
  if (configured) return configured as PolicyClass
  return resolveModelPolicy(resource.definition.model, config)
}

async function pupitreConfig(): Promise<PupitreConfig | undefined> {
  return (await app.container.make('pupitre.config').catch(() => undefined)) as
    PupitreConfig | undefined
}

async function allows(
  ctx: HttpContext,
  policy: PolicyClass | undefined,
  identity: string,
  ability: string,
  record?: LucidRow
): Promise<boolean> {
  if (!policy) {
    if (!warnedResources.has(identity)) {
      warnedResources.add(identity)
      ctx.logger
        .child({ module: 'pupitre' })
        .warn(`No authorization policy for "${identity}"; allowing access`)
    }
    return true
  }
  const bouncerContext = ctx as BouncerContext
  if (!bouncerContext.bouncer) throw new E_PUPITRE_BOUNCER_NOT_INITIALIZED()
  return bouncerContext.bouncer.with(policy).allows(ability, record)
}

export async function authorizeResource(
  ctx: HttpContext,
  resource: ResourceRuntime,
  ability: 'viewAny' | 'view' | 'create' | 'update' | 'delete' | string,
  record?: LucidRow
): Promise<boolean> {
  const policy = await resolveResourcePolicy(resource, await pupitreConfig())
  return allows(ctx, policy, `${resource.definition.model}:${resource.slug}`, ability, record)
}

/** Evaluates a host-registered Bouncer ability without a resource policy. */
export async function authorizeAbility(ctx: HttpContext, ability: string): Promise<boolean> {
  const bouncer = (ctx as BouncerContext).bouncer
  if (!bouncer) throw new E_PUPITRE_BOUNCER_NOT_INITIALIZED()
  return bouncer.allows(ability)
}

/**
 * Authorizes an ability against the policy of an arbitrary Lucid model (no
 * resource), resolved via `config.policies` as `<Model>Policy`. Used for
 * related models (options endpoint, relation managers). Default allow + warning
 * when the model has no policy.
 */
export async function authorizeModel(
  ctx: HttpContext,
  model: LucidModel,
  ability: string,
  record?: LucidRow
): Promise<boolean> {
  const resource = ctx.pupitre?.panel?.resources.find((candidate) => candidate.model === model)
  if (resource) {
    const policy = await resolveResourcePolicy(resource, await pupitreConfig())
    return allows(ctx, policy, `${resource.definition.model}:${resource.slug}`, ability, record)
  }
  const policy = await resolveModelPolicy(model.name, await pupitreConfig())
  return allows(ctx, policy, model.name, ability, record)
}

export async function ensureAuthorized(
  ctx: HttpContext,
  resource: ResourceRuntime,
  ability: 'viewAny' | 'view' | 'create' | 'update' | 'delete' | string,
  record?: LucidRow
): Promise<void> {
  if (!(await authorizeResource(ctx, resource, ability, record))) throw new E_PUPITRE_FORBIDDEN()
}
