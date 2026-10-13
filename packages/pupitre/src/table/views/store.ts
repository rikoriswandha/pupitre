import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import type { Database } from '@adonisjs/lucid/database'
import type { HttpContext } from '@adonisjs/core/http'
import type { TableViewDefinition } from './table_view.js'
import { E_PUPITRE_FORBIDDEN } from '../../errors.js'

export type ViewScope = { userId: string; panel: string; tenant: string | null; table: string }
export type StoredView = TableViewDefinition & {
  id: string
  source: 'preset' | 'public' | 'mine'
  editable: boolean
  isPublic: boolean
  isDefault: boolean
}
export function viewScope(ctx: HttpContext, table: string): ViewScope {
  const user = ctx.pupitre.user as { id?: string | number } | undefined
  if (user?.id === undefined) throw new E_PUPITRE_FORBIDDEN()
  return {
    userId: String(user.id),
    panel: ctx.pupitre.panel.id,
    tenant: ctx.pupitre.tenant ? String(ctx.pupitre.tenant.id) : null,
    table,
  }
}
async function database() {
  return app.container.make('lucid.db') as Promise<Database>
}
function scoped(db: Database, scope: ViewScope) {
  const query = db
    .from('pupitre_table_views')
    .where('panel', scope.panel)
    .where('table_key', scope.table)
  if (scope.tenant === null) query.whereNull('tenant_key')
  else query.where('tenant_key', scope.tenant)
  return query
}
function decode(value: unknown) {
  return typeof value === 'string' ? JSON.parse(value) : value
}
function serialize(row: Record<string, unknown>, scope: ViewScope): StoredView {
  const mine = String(row.user_id) === scope.userId
  return {
    id: String(row.id),
    name: String(row.name),
    query: decode(row.query),
    columns: decode(row.columns),
    source: mine ? 'mine' : 'public',
    editable: mine,
    isPublic: Boolean(row.is_public),
    isDefault: mine && Boolean(row.is_default),
  }
}
export async function listViews(scope: ViewScope): Promise<StoredView[]> {
  const db = await database()
  const rows = await scoped(db, scope)
    .where((query) => query.where('user_id', scope.userId).orWhere('is_public', true))
    .orderBy('name')
  return rows.map((row) => serialize(row, scope))
}
export async function findOwnedView(scope: ViewScope, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null
  const db = await database()
  const row = await scoped(db, scope).where('user_id', scope.userId).where('id', id).first()
  return row ? serialize(row, scope) : null
}
export async function saveView(
  scope: ViewScope,
  input: {
    name: string
    query: Record<string, unknown>
    columns: Record<string, boolean>
    isPublic: boolean
    isDefault: boolean
  },
  id?: string
) {
  const db = await database()
  const key = id ?? randomUUID()
  await db.transaction(async (trx) => {
    // Serialize defaults for this user, including concurrent requests on PostgreSQL.
    if (trx.dialect.name === 'postgres')
      await trx.rawQuery('select pg_advisory_xact_lock(hashtext(?))', [JSON.stringify(scope)])
    if (input.isDefault) {
      const defaults = scoped(trx as unknown as Database, scope).where('user_id', scope.userId)
      await defaults.update({ is_default: false })
    }
    const now = new Date().toISOString()
    const values = {
      name: input.name,
      query: JSON.stringify(input.query),
      columns: JSON.stringify(input.columns),
      is_public: input.isPublic,
      is_default: input.isDefault,
      updated_at: now,
    }
    if (id)
      await scoped(trx as unknown as Database, scope)
        .where('user_id', scope.userId)
        .where('id', key)
        .update(values)
    else
      await trx.table('pupitre_table_views').insert({
        ...values,
        id: key,
        user_id: scope.userId,
        panel: scope.panel,
        tenant_key: scope.tenant,
        table_key: scope.table,
        created_at: now,
      })
  })
  return findOwnedView(scope, key)
}
export async function deleteView(scope: ViewScope, id: string) {
  const db = await database()
  await scoped(db, scope).where('user_id', scope.userId).where('id', id).delete()
}
