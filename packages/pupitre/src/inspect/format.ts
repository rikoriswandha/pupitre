import type { PolicyInspection } from './report.js'

export function formatPolicyInspection(
  report: PolicyInspection[]
): Array<{ level: 'info' | 'warning'; message: string }> {
  const output: Array<{ level: 'info' | 'warning'; message: string }> = []
  for (const item of report) {
    output.push({ level: 'info', message: `${item.panel}.${item.resource} (${item.model})` })
    output.push({
      level: 'info',
      message: `  Strict authorization: ${item.strictAuthorization ? 'enabled' : 'disabled'}`,
    })
    for (const violation of item.violations ?? [])
      output.push({ level: 'warning', message: `  Missing policy: ${violation}` })
    output.push({
      level: item.allowByDefault ? 'warning' : 'info',
      message: item.allowByDefault
        ? '  WARNING: no policy found; authorization allows by default'
        : `  Policy: ${item.policy}`,
    })
    output.push({
      level: 'info',
      message: `  Searchable columns: ${item.searchableColumns.length ? item.searchableColumns.join(', ') : 'none'}`,
    })
    if (item.missingSearchableIndexes.length) {
      output.push({
        level: 'warning',
        message: `  Searchable columns without an index: ${item.missingSearchableIndexes.join(', ')}`,
      })
    } else if (item.searchableColumns.length) {
      output.push({ level: 'info', message: '  Searchable columns: all indexed' })
    }
    if (item.fieldClosures.length) {
      output.push({ level: 'info', message: '  Field closures:' })
      for (const field of item.fieldClosures) {
        const details = Object.entries(field)
          .filter(([key]) => key !== 'field')
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')
        output.push({ level: 'info', message: `    ${field.field}: ${details}` })
      }
    }
    if (item.missingAbilities.length) {
      output.push({
        level: 'warning',
        message: `  Policy is missing abilities: ${item.missingAbilities.join(', ')}`,
      })
    } else if (!item.allowByDefault) {
      output.push({ level: 'info', message: '  Required abilities: complete' })
    }
  }
  return output
}
