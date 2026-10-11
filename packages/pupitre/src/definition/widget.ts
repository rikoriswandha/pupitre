import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { TableDefinition } from './table.js'

export type WidgetFilterOption = { value: string; label: string }
export type WidgetFilterDefinition = { name: string; label: string; options: WidgetFilterOption[] }
export type WidgetStat = {
  label: string
  value: string | number
  description?: string
  descriptionIcon?: string
  color?: string
  chart?: number[]
}

export type WidgetData =
  | { kind: 'stats'; stats: WidgetStat[] }
  | {
      kind: 'chart'
      labels: string[]
      datasets: { label: string; data: number[]; color?: string }[]
    }
  | { kind: 'table'; data: unknown }
  | { kind: 'component'; data: unknown }

export type WidgetContext = { ctx: HttpContext; filters: Record<string, unknown>; record?: unknown }
export type WidgetDefinition = {
  name: string
  kind: 'stats' | 'chart' | 'table' | 'component'
  load?: (args: WidgetContext) => unknown | Promise<unknown>
  chartType?: 'line' | 'bar' | 'area' | 'pie' | 'doughnut'
  table?: TableDefinition
  model?: LucidModel
  component?: string
  heading?: string
  description?: string
  span: number | 'full'
  sort: number
  poll?: string
  canView?: (ctx: HttpContext) => boolean | Promise<boolean>
  lazy: boolean
  toJSON(): string
}
