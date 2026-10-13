import { BaseModel, column } from '@adonisjs/lucid/orm'

export class JobRun extends BaseModel {
  static table = 'pupitre_job_runs'
  static selfAssignPrimaryKey = true
  @column({ isPrimary: true }) declare id: string
  @column() declare jobId: string
  @column() declare name: string
  @column() declare queue: string
  @column() declare status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying'
  @column() declare attempt: number
  @column() declare tenantId: string | null
  @column() declare payloadSummary: string
  @column({ serializeAs: null }) declare retryPayload: string | null
  @column() declare retrySafe: boolean
  @column() declare errorMessage: string | null
  @column() declare errorStack: string | null
  @column() declare queuedAt: string
  @column() declare startedAt: string | null
  @column() declare finishedAt: string | null
  @column() declare durationMs: number | null
}
