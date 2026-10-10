import type { QueryCallback } from './table.js'
export type PageKind = 'list' | 'create' | 'edit' | 'view'
export type PageDefinition = {
  kind: PageKind
  component?: string
  redirectTo?: 'edit' | 'list' | 'view'
  tabs?: Record<string, { label?: string; where?: Record<string, unknown> | QueryCallback }>
}
