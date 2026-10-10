import type { StateStore } from '@json-render/core'

export function mapErrors(store: StateStore, errors: Record<string, unknown>): void {
  for (const [field, message] of Object.entries(errors)) {
    const first = Array.isArray(message) ? message[0] : message
    if (typeof first !== 'string') continue
    const path =
      field === '_form'
        ? '/errors/_form'
        : `/errors/${field
            .split('.')
            .map((part) => part.replaceAll('~', '~0').replaceAll('/', '~1'))
            .join('/')}`
    store.set(path, first)
  }
}
