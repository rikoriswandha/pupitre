import type { MiddlewareFn, ParsedNamedMiddleware } from '@adonisjs/http-server/types'
export type PanelDefinition = {
  id: string
  path: string
  guard?: string
  middleware: readonly (MiddlewareFn | ParsedNamedMiddleware)[]
  resources: readonly unknown[] | Record<string, unknown>
  brand?: { name: string; logo?: string; favicon?: string }
  theme?: { primary?: string; darkMode?: string }
  timezone?: string
  locale?: 'en'
  breadcrumbs: boolean
  toJSON(): string
}
