import { actions, definePlugin, defineResource, nav, pages, schema, table } from '@rikology/pupitre'
import type { PupitrePlugin, ResourceDefinition } from '@rikology/pupitre'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidRow, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import shieldContextMiddleware from './middleware.js'
import Role from './models/role.js'
import Permission from './models/permission.js'
import {
  invalidateShieldPermissions,
  resourceAbilities,
  shieldAllows,
  shieldAllowsSync,
  shieldPolicyFor,
  type ShieldOptions,
} from './permissions.js'
export const panelShieldOptions = new WeakMap<object, ShieldOptions>()
type RoleRelationshipClient = {
  query(): ModelQueryBuilderContract<typeof Role>
  sync(ids: string[]): Promise<unknown>
}
function roleRelationship(record: LucidRow): RoleRelationshipClient {
  return record.related('roles' as never) as unknown as RoleRelationshipClient
}
function shieldForPanel(options: ShieldOptions) {
  const resources = new Map<string, Pick<ResourceDefinition, 'slug' | 'actions' | 'pluralLabel'>>()
  const withRoleAssignments = (
    resource: ResourceDefinition<LucidRow>
  ): ResourceDefinition<LucidRow> => {
    const hasRolesField = (nodes: unknown): boolean => {
      if (!nodes || typeof nodes !== 'object') return false
      if (Array.isArray(nodes)) return nodes.some(hasRolesField)
      const node = nodes as Record<string, unknown>
      const relationship = node.relationship as { name?: string } | undefined
      if (node.kind === 'multiSelect' && node.name === 'roles' && relationship?.name === 'roles')
        return true
      // Layouts retain the same form-data path; repeating fields do not.
      return hasRolesField(node.children) || hasRolesField(node.steps)
    }
    if (!hasRolesField(resource.form)) return resource
    const save = async (
      data: Record<string, unknown>,
      record: LucidRow | null,
      ctx: HttpContext,
      trx: TransactionClientContract
    ) => {
      const { roles: submitted, ...attributes } = data
      if (submitted === undefined) return { attributes }
      if (!ctx.pupitre.authUser)
        throw new Exception('Role assignments require an authenticated user', { status: 403 })
      if (
        !Array.isArray(submitted) ||
        submitted.some(
          (id) =>
            (typeof id !== 'number' && (typeof id !== 'string' || !/^[0-9]+$/.test(id))) ||
            !Number.isInteger(Number(id)) ||
            Number(id) < 1 ||
            Number(id) > 2147483647
        )
      )
        throw new Exception('Invalid role assignment', { status: 422 })
      const ids = [...new Set(submitted.map((id) => String(Number(id))))]
      const selected = await Role.query({ client: trx }).whereIn('id', ids).select('id')
      if (selected.length !== ids.length)
        throw new Exception('Unknown role assignment', { status: 422 })
      record?.useTransaction(trx)
      const current = record ? await roleRelationship(record).query() : []
      const currentIds = new Set(current.map((role) => String(Reflect.get(role, 'id'))))
      const nextIds = new Set(ids)
      const changedIds = [
        ...ids.filter((id) => !currentIds.has(id)),
        ...[...currentIds].filter((id) => !nextIds.has(id)),
      ]
      if (changedIds.length && !(await shieldAllows(ctx, ctx.pupitre.authUser, '', options, trx))) {
        if (!(await shieldAllows(ctx, ctx.pupitre.authUser, 'roles.update', options, trx)))
          throw new Exception('Cannot assign or revoke roles', { status: 403 })
        const changed = await Role.query({ client: trx })
          .whereIn('id', changedIds)
          .preload('permissions')
        for (const role of changed) {
          if (role.name === (options.superAdminRole ?? 'super-admin'))
            throw new Exception('Cannot assign or revoke the super administrator role', {
              status: 403,
            })
          for (const permission of role.permissions) {
            if (!(await shieldAllows(ctx, ctx.pupitre.authUser, permission.name, options, trx)))
              throw new Exception('Cannot delegate a permission you do not possess', {
                status: 403,
              })
          }
        }
      }
      return { attributes, ids }
    }
    const sync = async (
      record: LucidRow,
      ids: string[] | undefined,
      trx: TransactionClientContract
    ) => {
      if (!ids) return
      record.useTransaction(trx)
      await roleRelationship(record).sync(ids)
      invalidateShieldPermissions()
    }
    return {
      ...resource,
      hooks: {
        ...resource.hooks,
        async fill(record, ctx) {
          const row = record as LucidRow
          const data = resource.hooks.fill
            ? await resource.hooks.fill(record, ctx)
            : row.serialize()
          const roles = await roleRelationship(row).query()
          return { ...data, roles: roles.map((role) => Reflect.get(role, 'id')) }
        },
      },
      handlers: {
        async create(data, ctx, trx) {
          const { attributes, ids } = await save(data, null, ctx, trx)
          const record = resource.handlers.create
            ? await resource.handlers.create(attributes, ctx, trx)
            : await resource.modelClass!.create(attributes, { client: trx })
          await sync(record as LucidRow, ids, trx)
          return record
        },
        async update(record, data, ctx, trx) {
          const row = record as LucidRow
          const { attributes, ids } = await save(data, row, ctx, trx)
          row.useTransaction(trx)
          const saved = resource.handlers.update
            ? await resource.handlers.update(record, attributes, ctx, trx)
            : await row.merge(attributes).save()
          await sync(saved as LucidRow, ids, trx)
          return saved
        },
      },
    }
  }
  const allowedPermissions = new Set<string>()
  const authorizeChange = async (
    ctx: HttpContext,
    data: Record<string, unknown>,
    trx: TransactionClientContract,
    record?: Role
  ) => {
    if (await shieldAllows(ctx, ctx.pupitre.authUser, '', options, trx)) return
    const superAdmin = options.superAdminRole ?? 'super-admin'
    if (data.name === superAdmin || record?.name === superAdmin)
      throw new Exception('Cannot modify the super administrator role', { status: 403 })
    const names = new Set(
      Object.entries(data)
        .filter(([key]) => key.startsWith('permissions_'))
        .flatMap(([, value]) => (Array.isArray(value) ? value.map(String) : []))
    )
    record?.useTransaction(trx)
    const existing = record
      ? await record
          .related('permissions')
          .query()
          .whereIn('name', [...allowedPermissions])
      : []
    const current = new Set(existing.map((permission) => permission.name))
    const changed = [
      ...[...names].filter((name) => !current.has(name)),
      ...[...current].filter((name) => !names.has(name)),
    ]
    for (const name of changed) {
      if (!(await shieldAllows(ctx, ctx.pupitre.authUser, name, options, trx)))
        throw new Exception('Cannot grant or revoke a permission you do not possess', {
          status: 403,
        })
    }
  }
  const savePermissions = async (
    record: Role,
    data: Record<string, unknown>,
    trx: TransactionClientContract
  ) => {
    const names = Object.entries(data)
      .filter(([key]) => key.startsWith('permissions_'))
      .flatMap(([, value]) => (Array.isArray(value) ? value.map(String) : []))
    if (names.some((name) => !allowedPermissions.has(name)))
      throw new Error('Unknown Shield permission')
    const permissions = await Permission.fetchOrCreateMany(
      'name',
      names.map((name) => ({ name })),
      { client: trx }
    )
    // Page/host permissions are managed outside this resource-derived form.
    const external = await record
      .related('permissions')
      .query()
      .whereNotIn('name', [...allowedPermissions])
    await record
      .related('permissions')
      .sync([...permissions, ...external].map((permission) => permission.id))
    invalidateShieldPermissions()
  }
  const roles = defineResource(Role)
    .slug('roles')
    .label('Role')
    .pluralLabel('Roles')
    .scope(false)
    .form((s) => [s.text('name').required().maxLength(160).unique({ ignoreRecord: true })])
    .table((t) => t.columns([table.text('name').searchable().sortable()]))
    .fill(async (record) => {
      await record.load('permissions')
      return {
        name: record.name,
        ...Object.fromEntries(
          [...resources.values()].map((resource) => [
            'permissions_' + resource.slug,
            record.permissions
              .filter((permission) => permission.name.startsWith(resource.slug + '.'))
              .map((permission) => permission.name),
          ])
        ),
      }
    })
    .create(async (data, ctx, trx) => {
      await authorizeChange(ctx, data, trx)
      const record = await Role.create({ name: String(data.name) }, { client: trx })
      await savePermissions(record, data, trx)
      return record
    })
    .update(async (record, data, ctx, trx) => {
      await authorizeChange(ctx, data, trx, record)
      record.useTransaction(trx)
      await record.merge({ name: String(data.name) }).save()
      await savePermissions(record, data, trx)
      return record
    })
    .actions({ header: [actions.create()], row: [actions.edit(), actions.delete()] })
    .pages({ list: pages.list(), create: pages.create(), edit: pages.edit() })
  return definePlugin({
    name: 'shield',
    resources: [roles],
    navigation: [nav.group(options.navigationGroup ?? 'Settings').items(['roles'])],
    middleware: [shieldContextMiddleware],
    extendResource(resource) {
      if (resource.slug === 'roles')
        resource = roles.toDefinition() as unknown as ResourceDefinition<LucidRow>
      const selected =
        resource.slug === 'roles' ||
        ((!options.resources ||
          options.resources === 'all' ||
          options.resources.includes(resource.slug)) &&
          !options.except?.includes(resource.slug))
      const extended = withRoleAssignments(resource)
      if (selected && !extended.policy) {
        resources.set(resource.slug, extended)
        return { ...extended, policy: shieldPolicyFor(extended, options) }
      }
      return extended
    },
    boot({ panel }) {
      panelShieldOptions.set(panel, options)
      // Relation actions authorize the related model, not their owning resource.
      const visit = (value: unknown): void => {
        if (!value || typeof value !== 'object') return
        if ('relation' in value && 'parentModelClass' in value) {
          const relationManager = value as {
            relation: string
            parentModelClass: NonNullable<ResourceDefinition['modelClass']>
            actions: ResourceDefinition['actions']
          }
          const relation = relationManager.parentModelClass.$getRelation(relationManager.relation)
          relation.boot()
          const target = panel.resources.find((item) => item.model === relation.relatedModel())
          const resource = target && resources.get(target.slug)
          if (resource) {
            resources.set(resource.slug, {
              ...resource,
              actions: {
                ...resource.actions,
                row: [...(resource.actions?.row ?? []), ...(relationManager.actions?.row ?? [])],
                header: [
                  ...(resource.actions?.header ?? []),
                  ...(relationManager.actions?.header ?? []),
                ],
                bulk: [...(resource.actions?.bulk ?? []), ...(relationManager.actions?.bulk ?? [])],
              },
            })
          }
          return
        }
        for (const child of Object.values(value)) visit(child)
      }
      for (const resource of panel.resources) visit(resource.definition.relations)
      for (const resource of panel.resources) {
        const enforced = resources.get(resource.slug)
        if (enforced) resource.definition.policy = shieldPolicyFor(enforced, options)
      }
      for (const resource of resources.values()) {
        for (const ability of resourceAbilities(resource))
          allowedPermissions.add(resource.slug + '.' + ability)
      }
      const role = panel.resources.find((resource) => resource.slug === 'roles')!
      role.definition.form = [
        schema.text('name').required().maxLength(160).unique({ ignoreRecord: true }).toDefinition(),
        ...[...resources.values()].map((resource) =>
          schema
            .section(resource.pluralLabel)
            .components([
              schema
                .checkboxList('permissions_' + resource.slug)
                .label('Permissions')
                .options(
                  Object.fromEntries(
                    resourceAbilities(resource).map((ability) => [
                      resource.slug + '.' + ability,
                      ability,
                    ])
                  )
                ),
            ])
            .toDefinition()
        ),
      ]
    },
  })
}
export function shield(options: ShieldOptions) {
  const panels = new Map<string, PupitrePlugin>()
  const forPanel = (id: string) => {
    let plugin = panels.get(id)
    if (!plugin) {
      plugin = shieldForPanel(options)
      panels.set(id, plugin)
    }
    return plugin
  }
  const template = shieldForPanel(options)
  return definePlugin({
    ...template,
    extendResource(resource, context) {
      return forPanel(context.panel.id).extendResource!(resource, context)
    },
    boot(context) {
      return forPanel(context.panel.id).boot!(context)
    },
  })
}
export function shieldRolesField() {
  return schema
    .multiSelect('roles')
    .label('Roles')
    .relationship('roles', 'name')
    .preload()
    .visible(({ ctx }) =>
      ctx
        ? shieldAllowsSync(ctx, 'roles.viewAny', panelShieldOptions.get(ctx.pupitre.panel))
        : false
    )
    .dehydratedWhenHidden(false)
}
