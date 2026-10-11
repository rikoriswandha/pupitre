import type {} from '../types.js'
import type { HttpContext } from '@adonisjs/core/http'

/** Closure evaluated per request (e.g. nav badges, visibility). */
export type NavClosure<T> = (ctx: HttpContext) => T | Promise<T>

/**
 * One navigation entry. `resource` / `page` reference a registered resource
 * or custom page by slug; `url` is a literal link.
 */
export type NavItemDefinition = {
  type: 'item'
  label?: string
  resource?: string
  page?: string
  url?: string
  icon?: string
  external?: boolean
  sort?: number
  badge?: string | number | NavClosure<string | number | null | undefined>
  visible?: boolean | NavClosure<boolean>
}

export type NavGroupDefinition = {
  type: 'group'
  label: string
  icon?: string
  sort?: number
  collapsible: boolean
  collapsed: boolean
  items: NavItemDefinition[]
}

export type NavEntryDefinition = NavGroupDefinition | NavItemDefinition

/** Entry of the user menu in the topbar (in addition to built-in profile/logout). */
export type UserMenuItemDefinition = {
  label: string
  url: string
  icon?: string
  method?: 'get' | 'post'
  external?: boolean
  sort?: number
  visible?: boolean | NavClosure<boolean>
}
