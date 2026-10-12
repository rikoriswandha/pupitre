import app from '@adonisjs/core/services/app'
import { HttpContext } from '@adonisjs/core/http'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { Database } from '@adonisjs/lucid/database'
import { DateTime } from 'luxon'
import { compileValidator, definePage, definePlugin, nav, t } from '@rikology/pupitre'
import type {
  CustomPageBuilder,
  PupitreConfig,
  ActionBuilder,
  SchemaNodeDefinition,
} from '@rikology/pupitre'
export { configure } from './configure.js'

export type SettingsValues = Record<string, unknown>
export type SettingsContext = { tenant?: { id: string | number }; ctx?: HttpContext }
export type SettingsOptions = {
  groups: readonly SettingsGroup<SettingsValues>[]
  navigationGroup?: string
  authorize?: (ctx: HttpContext, group: SettingsGroup<SettingsValues>) => boolean | Promise<boolean>
}

/** JSON preparation is explicit for SQLite and PostgreSQL; the latter returns decoded values. */
export class Setting extends BaseModel {
  static table = 'pupitre_settings'
  @column({ isPrimary: true }) declare id: number
  @column() declare group: string
  @column() declare scopeKey: string
  @column() declare key: string
  @column({
    prepare: (value: unknown) => JSON.stringify({ value }),
    consume: (raw: unknown) => {
      const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!value || typeof value !== 'object' || !('value' in value))
        throw new Error('Invalid settings JSON envelope')
      return value.value
    },
  })
  declare value: unknown
  @column.dateTime({ autoCreate: true }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true }) declare updatedAt: DateTime
}

export class SettingsGroup<T extends SettingsValues> {
  constructor(
    readonly name: string,
    readonly page: CustomPageBuilder,
    readonly defaultValues: T,
    readonly settingsScope: 'global' | 'tenant' = 'global'
  ) {}
  private change(page = this.page, defaults = this.defaultValues, scope = this.settingsScope) {
    return new SettingsGroup(this.name, page, defaults, scope)
  }
  label(value: string) {
    return this.change(
      this.page.title(value).navigation({ ...this.page.definition.navigation, label: value })
    )
  }
  icon(value: string) {
    return this.change(this.page.icon(value))
  }
  sort(value: number) {
    return this.change(this.page.navigation({ ...this.page.definition.navigation, sort: value }))
  }
  form(callback: Parameters<CustomPageBuilder['form']>[0]) {
    return this.change(this.page.form(callback))
  }
  defaults<Values extends SettingsValues>(value: Values): SettingsGroup<Values> {
    return new SettingsGroup(this.name, this.page, value, this.settingsScope)
  }
  scope(value: 'global' | 'tenant') {
    return this.change(this.page, this.defaultValues, value)
  }
  actions(value: readonly ActionBuilder[]) {
    return this.change(this.page.actions(value))
  }
}

export function defineSettings(name: string) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Invalid settings group name')
  return new SettingsGroup(
    name,
    definePage(name === 'general' ? 'settings' : `settings-${name}`)
      .title(t('Settings'))
      .icon('settings'),
    {}
  )
}

function contextScope(group: SettingsGroup<SettingsValues>, options: SettingsContext) {
  if (group.settingsScope === 'global') return 'global'
  const ctx = options.ctx ?? HttpContext.get()
  const tenant = ctx ? ctx.pupitre?.tenant : options.tenant
  if (!tenant || (options.tenant && String(options.tenant.id) !== String(tenant.id)))
    throw new Error('Tenant settings require the active tenant')
  return `tenant:${tenant.id}`
}

const cache = new WeakMap<HttpContext, Map<string, Promise<SettingsValues>>>()
function requestCache(ctx: HttpContext) {
  let entries = cache.get(ctx)
  if (!entries) {
    entries = new Map()
    cache.set(ctx, entries)
  }
  return entries
}

/** Explicitly discards only the current request's cached settings. */
export function clearSettingsCache(ctx = HttpContext.get()) {
  if (ctx) cache.delete(ctx)
}

export async function settingsFor<T extends SettingsValues>(
  group: SettingsGroup<T>,
  options: SettingsContext = {}
): Promise<T> {
  const scope = contextScope(group, options)
  const ctx = options.ctx ?? HttpContext.get()
  const load = async () => {
    const values: SettingsValues = structuredClone(group.defaultValues)
    const rows = await Setting.query().where('group', group.name).where('scope_key', scope)
    for (const row of rows) if (Object.hasOwn(values, row.key)) values[row.key] = row.value
    return values as T
  }
  if (!ctx) return load()
  const entries = requestCache(ctx)
  const key = JSON.stringify([group.name, scope])
  let pending = entries.get(key)
  if (!pending) {
    pending = load()
    entries.set(key, pending)
  }
  return structuredClone(await pending) as T
}

export async function saveSettings<T extends SettingsValues>(
  group: SettingsGroup<T>,
  patch: Partial<T>,
  options: SettingsContext = {}
): Promise<void> {
  const ctx = options.ctx ?? HttpContext.get() ?? undefined
  const merged = { ...(await settingsFor(group, options)), ...patch }
  const validated = await compileValidator(group.page.definition.form ?? []).validate(merged, {
    ctx,
    timezone: ctx?.pupitre?.timezone ?? 'UTC',
  })
  await persistSettings(group, validated, Object.keys(patch), options)
}

/** Page handlers pass validator output here: transforms must run exactly once. */
async function persistSettings(
  group: SettingsGroup<SettingsValues>,
  validated: SettingsValues,
  keys: string[],
  options: SettingsContext
): Promise<void> {
  const scope = contextScope(group, options)
  const ctx = options.ctx ?? HttpContext.get()
  const db: Database = await app.container.make('lucid.db')
  const now = DateTime.now().toSQL()
  const rows = keys.map((key) => {
    if (!Object.hasOwn(group.defaultValues, key)) throw new Error(`Unknown settings key: ${key}`)
    if (!Object.hasOwn(validated, key))
      throw new Error(`Settings key is not a writable form field: ${key}`)
    if (JSON.stringify(validated[key]) === undefined)
      throw new Error(`Settings value is not JSON: ${key}`)
    return {
      group: group.name,
      scope_key: scope,
      key,
      value: JSON.stringify({ value: validated[key] }),
      created_at: now,
      updated_at: now,
    }
  })
  if (rows.length)
    await db.transaction(async (trx) => {
      await trx
        .table(Setting.table)
        .insert(rows)
        .onConflict(['group', 'scope_key', 'key'])
        .merge(['value', 'updated_at'])
    })
  if (ctx) requestCache(ctx).delete(JSON.stringify([group.name, scope]))
}

export async function authorizeSettings(
  ctx: HttpContext,
  group: SettingsGroup<SettingsValues>,
  options: SettingsOptions,
  config: PupitreConfig
): Promise<boolean> {
  if (group.settingsScope === 'tenant' && !ctx.pupitre?.tenant) return false
  if (options.authorize) return options.authorize(ctx, group)
  const policies = await config.policies?.()
  const candidate = policies?.SettingsPolicy
  const policy =
    candidate && typeof candidate === 'object' && 'default' in candidate
      ? candidate.default
      : candidate
  if (
    typeof policy !== 'function' ||
    !('prototype' in policy) ||
    typeof policy.prototype.viewAny !== 'function' ||
    typeof policy.prototype.manage !== 'function'
  )
    return false
  const bouncer = (
    ctx as HttpContext & {
      bouncer?: {
        with(value: typeof policy): {
          allows(ability: string, group?: SettingsGroup<SettingsValues>): Promise<boolean>
        }
      }
    }
  ).bouncer
  if (!bouncer) return false
  const gate = bouncer.with(policy)
  return (await gate.allows('viewAny')) && (await gate.allows('manage', group))
}

function assertDefaults(
  group: SettingsGroup<SettingsValues>,
  nodes: readonly SchemaNodeDefinition[]
) {
  for (const node of nodes) {
    if (node.kind === 'wizard') {
      for (const step of node.steps) assertDefaults(group, step.children)
    } else if ('children' in node) {
      assertDefaults(group, node.children)
    } else if (
      'name' in node &&
      node.kind !== 'placeholder' &&
      !node.kind.endsWith('Entry') &&
      !('dehydrated' in node && node.dehydrated === false) &&
      !(
        'disabled' in node &&
        node.disabled === true &&
        !('dehydrated' in node && node.dehydrated === true)
      ) &&
      !Object.hasOwn(group.defaultValues, node.name)
    ) {
      throw new Error(
        `Settings group "${group.name}" requires a default for form field "${node.name}"`
      )
    }
  }
}

export function settings(options: SettingsOptions) {
  if (new Set(options.groups.map((group) => group.name)).size !== options.groups.length)
    throw new Error('Duplicate settings group')
  for (const group of options.groups) assertDefaults(group, group.page.definition.form ?? [])
  const pages = options.groups.map((group) =>
    group.page
      .canAccess(async (ctx) =>
        authorizeSettings(ctx, group, options, await app.container.make('pupitre.config'))
      )
      .fill((ctx) => settingsFor(group, { ctx }))
      .save(async ({ ctx, data }) => {
        if (
          !(await authorizeSettings(
            ctx,
            group,
            options,
            await app.container.make('pupitre.config')
          ))
        )
          throw new Error(t('Settings access denied'))
        await persistSettings(group, data, Object.keys(data), { ctx })
      })
  )
  return definePlugin({
    name: 'settings',
    messages: { id: { 'Settings access denied': 'Akses pengaturan ditolak' } },
    pages,
    navigation: [
      nav.group(options.navigationGroup ?? t('Settings')).items(
        pages.map((page) =>
          nav
            .item()
            .page(page.definition.slug)
            .sort(page.definition.navigation?.sort ?? 0)
        )
      ),
    ],
  })
}
