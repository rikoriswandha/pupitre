import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type Audit from '@rikology/adonisjs-audit-trail/models/audit'
import type { AuditAdapter, AuditEntry, AuditPagination, AuditPage } from '../adapters/audit.js'
import { toDateTime } from '../format/index.js'
import type { DateInput } from '../format/index.js'

export type AuditDriverOptions = {
  /** Auditable uses the constructor name. Override for explicit domain/morph references. */
  auditableType?: (model: LucidModel) => string
}

export function normalizeAudit(row: Audit): AuditEntry {
  const oldValues = row.oldValues ?? {}
  const newValues = row.newValues ?? {}
  // Keep the raw timestamp: the peer writes ISO on SQLite, while Lucid's dateTime
  // consumer expects SQL strings and can hydrate an invalid DateTime.
  const createdAt = toDateTime((row.$extras.pupitre_created_at ?? row.createdAt) as DateInput)
  if (!createdAt) throw new Error(`Audit "${row.id}" has an invalid created_at timestamp`)
  return {
    id: row.id,
    event: row.event,
    auditableType: row.auditableType,
    auditableId: row.auditableId,
    actor: row.actorType
      ? {
          type: row.actorType,
          id: row.actorId,
          ...(row.actorLabel ? { label: row.actorLabel } : {}),
        }
      : null,
    changes: [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])].map((field) => ({
      field,
      old: oldValues[field] ?? null,
      new: newValues[field] ?? null,
    })),
    tags: row.tags,
    createdAt: createdAt.toISO()!,
  }
}

async function auditModel() {
  try {
    // Static loading would make the optional audit peer mandatory for every host.
    const peer = await import('@rikology/adonisjs-audit-trail/models/audit')
    return peer.default
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND')
    ) {
      throw new Error(
        'Pupitre auditAdapter requires @rikology/adonisjs-audit-trail. Install and configure the audit-trail peer before reading activity.',
        { cause: error }
      )
    }
    throw error
  }
}

async function paginate(
  query: ModelQueryBuilderContract<typeof Audit>,
  pagination: AuditPagination = {}
): Promise<AuditPage> {
  const page = pagination.page ?? 1
  const perPage = pagination.perPage ?? 25
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(perPage) || perPage < 1)
    throw new Error('Audit pagination requires positive integer page and perPage')
  const result = await query
    .select('*', 'created_at as pupitre_created_at')
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .paginate(page, perPage)
  const meta = result.getMeta()
  return {
    items: result.all().map(normalizeAudit),
    meta: {
      total: Number(meta.total),
      perPage: meta.perPage,
      currentPage: meta.currentPage,
      lastPage: meta.lastPage,
    },
  }
}

/** Loads the optional peer only when a read is requested; values remain peer-redacted. */
export function auditAdapter(options: AuditDriverOptions = {}): AuditAdapter {
  return {
    async forRecord(model, id, pagination) {
      const Model = await auditModel()
      const query = Model.query()
        .where('auditable_type', options.auditableType?.(model) ?? model.name)
        .where('auditable_id', String(id))
      if (pagination?.tenantId !== undefined) query.where('tenant_id', pagination.tenantId)
      return paginate(query, pagination)
    },
  }
}
