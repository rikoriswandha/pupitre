import type { LucidModel } from '@adonisjs/lucid/types/model'

export type AuditChange = { field: string; old: unknown; new: unknown }
export type AuditEntry = {
  id: string
  event: string
  auditableType: string | null
  auditableId: string | null
  actor: { type: string; id: string | null; label?: string } | null
  changes: AuditChange[]
  tags: string[]
  createdAt: string
}
export type AuditPagination = { page?: number; perPage?: number }
export type AuditRecordOptions = AuditPagination & { tenantId?: string }
export type AuditPage = {
  items: AuditEntry[]
  meta: { total: number; perPage: number; currentPage: number; lastPage: number }
}
/** Hosts own audit capture, storage, retention and redaction. Pupitre only reads it. */
export interface AuditAdapter {
  forRecord(
    model: LucidModel,
    id: string | number,
    options?: AuditRecordOptions
  ): Promise<AuditPage>
}
