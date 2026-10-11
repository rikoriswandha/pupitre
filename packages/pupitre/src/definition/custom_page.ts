import type { HttpContext } from '@adonisjs/core/http'
import type { ActionDefinition } from './action.js'
import type { SchemaNodeDefinition } from './schema.js'

export type CustomPageDefinition = {
  slug: string
  /** Path relative to the panel (tenant) prefix, e.g. `/settings`. */
  path: string
  title: string
  icon?: string
  navigation?: {
    group?: string
    sort?: number
    label?: string
    badge?: (ctx: HttpContext) => unknown | Promise<unknown>
  }
  /** Access gate (nav visibility + 403 on the route). Default: allowed. */
  canAccess?: (ctx: HttpContext) => boolean | Promise<boolean>
  form?: SchemaNodeDefinition[]
  fill?: (ctx: HttpContext) => Record<string, unknown> | Promise<Record<string, unknown>>
  save?: (args: { data: Record<string, unknown>; ctx: HttpContext }) => unknown | Promise<unknown>
  actions: ActionDefinition[]
  component?: string
  toJSON(): string
}
