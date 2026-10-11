/** Resolve schema paths across repeater rows and typed builder block `.data` payloads. */
export function valuesAt(value: unknown, path: string): unknown[] {
  const visit = (current: unknown, segments: string[]): unknown[] => {
    if (!segments.length) return [current]
    const [segment, ...rest] = segments
    if (Array.isArray(current)) {
      return current.flatMap((row) => {
        if (
          row &&
          typeof row === 'object' &&
          'type' in row &&
          'data' in row &&
          rest[0] === 'data'
        ) {
          return row.type === segment ? visit(row, rest) : []
        }
        return visit(row, segments)
      })
    }
    if (!current || typeof current !== 'object') return []
    return visit((current as Record<string, unknown>)[segment], rest)
  }
  return visit(value, path.split('.'))
}
