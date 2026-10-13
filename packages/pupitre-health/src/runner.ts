import type { HealthChecks } from '@adonisjs/core/health'
import type { HealthCheckReport } from '@adonisjs/core/types/health'

export type HealthStatus = 'ok' | 'warning' | 'error'
export type HealthSnapshot = {
  status: HealthStatus
  finishedAt: string
  counts: Record<HealthStatus, number>
  rows: Record<string, unknown>[]
}

const numericKeys: Record<string, true> = {
  used: true,
  limit: true,
  total: true,
  available: true,
  free: true,
  active: true,
  warningThreshold: true,
  failureThreshold: true,
  totalSystemMemory: true,
  heapSizeLimit: true,
  totalHeapSize: true,
  usedHeapSize: true,
}
const groups: Record<string, true> = {
  memoryInBytes: true,
  sizeInPercentage: true,
  diskSpace: true,
  connections: true,
}
/** Only known numeric measurements may cross the HTTP boundary. */
export function safeHealthMeta(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (Object.hasOwn(numericKeys, key) && typeof value === 'number' && Number.isFinite(value))
      result[key] = value
    else if (
      Object.hasOwn(groups, key) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const nested = safeHealthMeta(value as Record<string, unknown>)
      if (Object.keys(nested).length) result[key] = nested
    }
  }
  return result
}

function snapshot(report: HealthCheckReport): HealthSnapshot {
  const counts = { ok: 0, warning: 0, error: 0 }
  const rows = report.checks.map((check, index) => {
    counts[check.status]++
    return {
      id: String(index),
      name: check.name,
      status: check.status,
      message: check.message,
      measurements: JSON.stringify(safeHealthMeta(check.meta)),
    }
  })
  return { status: report.status, finishedAt: report.finishedAt.toISOString(), counts, rows }
}

/** One instance per plugin; results describe process infrastructure, not tenant records. */
export class HealthRunner {
  #cached?: HealthSnapshot
  #expiresAt = 0
  #pending?: Promise<HealthSnapshot>
  constructor(
    readonly checks: Pick<HealthChecks, 'run'>,
    readonly cacheSeconds = 60,
    private readonly now = Date.now
  ) {
    if (!Number.isFinite(cacheSeconds) || cacheSeconds < 0)
      throw new Error('Health cacheSeconds must be a non-negative finite number')
  }
  async run(force = false): Promise<HealthSnapshot> {
    if (this.#pending) return this.#pending
    if (!force && this.#cached && this.now() < this.#expiresAt) return this.#cached
    this.#pending = this.checks.run().then((report) => {
      const result = snapshot(report)
      this.#cached = result
      this.#expiresAt = this.now() + this.cacheSeconds * 1000
      return result
    })
    try {
      return await this.#pending
    } finally {
      this.#pending = undefined
    }
  }
}
