import { Job } from '@adonisjs/queue'
import app from '@adonisjs/core/services/app'
import { mkdir, writeFile } from 'node:fs/promises'
import Post from '#models/post'

/** Ordinary host job: no monitor base class or instrumentation is required. */
export default class MonitorDemoJob extends Job<{ tenantId: number; name: string }> {
  static options = { maxRetries: 0 }
  async execute() {
    if (!this.payload.name || !this.payload.tenantId)
      throw new Error('Demo job requires a tenant and name')
    const rows = await Post.query()
      .where('tenant_id', this.payload.tenantId)
      .select('status')
      .count('* as total')
      .groupBy('status')
    const directory = app.tmpPath('job-reports')
    await mkdir(directory, { recursive: true })
    await writeFile(
      `${directory}/${this.context.jobId}.json`,
      JSON.stringify({
        tenantId: this.payload.tenantId,
        name: this.payload.name,
        counts: rows.map((row) => ({ status: row.status, total: Number(row.$extras.total) })),
      })
    )
  }
}
