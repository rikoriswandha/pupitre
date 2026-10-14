import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { TableDefinition } from './table.js'
import type { ActionDefinition } from './action.js'

export type WidgetFilterOption = { value: string; label: string }
export type WidgetFilterDefinition = { name: string; label: string; options: WidgetFilterOption[] }
export type WidgetStat = {
  label: string
  /** Numbers are formatted with the request's number locale; strings are shown as given. */
  value: string | number
  /** ISO 4217 currency: a numeric value renders as money in the number locale. */
  money?: string
  /** Shorten a numeric value (`105,9 jt`, `105.9M`); the full value shows on hover. */
  compact?: boolean
  description?: string
  descriptionIcon?: string
  color?: string
  chart?: number[]
}

export type TimelineItem = {
  title: string
  description?: string
  time: string
  actor?: string
  icon?: string
  color?: string
  changes?: { field: string; old: unknown; new: unknown }[]
}

export type WidgetData =
  | { kind: 'stats'; stats: WidgetStat[] }
  | {
      kind: 'chart'
      labels: string[]
      datasets: { label: string; data: number[]; color?: string }[]
    }
  | {
      kind: 'scatter'
      datasets: { label: string; data: { x: number; y: number }[]; color?: string }[]
    }
  | { kind: 'table'; data: unknown }
  | { kind: 'timeline'; items: TimelineItem[] }
  | { kind: 'component'; data: unknown }

export type WidgetContext = { ctx: HttpContext; filters: Record<string, unknown>; record?: unknown }
export type WidgetDefinition = {
  name: string
  kind: 'stats' | 'chart' | 'table' | 'timeline' | 'component'
  load?: (args: WidgetContext) => unknown | Promise<unknown>
  chartType?: 'line' | 'bar' | 'area' | 'pie' | 'doughnut' | 'radar' | 'scatter'
  table?: TableDefinition
  model?: LucidModel
  component?: string
  actions?: readonly ActionDefinition[]
  heading?: string
  description?: string
  span: number | 'full'
  sort: number
  poll?: string
  /** `record` is the page record for resource edit/view page widgets. */
  canView?: (ctx: HttpContext, record?: unknown) => boolean | Promise<boolean>
  lazy: boolean
  toJSON(): string
}
