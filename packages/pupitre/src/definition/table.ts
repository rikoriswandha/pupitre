import type { HttpContext } from '@adonisjs/core/http'
import type { ModelQueryBuilderContract, LucidModel } from '@adonisjs/lucid/types/model'
import type { SchemaNodeBuilder, SchemaNodeDefinition } from './schema.js'
import type { ActionBuilder, ActionDefinition } from './action.js'
export type QueryCallback = (
  query: ModelQueryBuilderContract<LucidModel>,
  ctx: HttpContext
) => unknown
export type TableColumnBase = {
  name: string
  searchable?: boolean
  sortable?: boolean
  label?: string
  alignment?: 'start' | 'center' | 'end'
  width?: string
  toggleable?: { hiddenByDefault?: boolean }
}
export type TextColumnDefinition = TableColumnBase & {
  kind: 'text'
  limit?: number
  wrap?: boolean
  description?: (args: { record: unknown }) => unknown
  badge?: boolean
  money?: string
  numeric?: boolean
  dateTime?: boolean
  date?: boolean
  since?: boolean
  copyable?: boolean
  url?: (args: { record: unknown }) => string
}
export type BadgeColumnDefinition = TableColumnBase & {
  kind: 'badge'
  colors?: Record<string, string>
}
export type IconColumnDefinition = TableColumnBase & {
  kind: 'icon'
  icons?: Record<string, string>
  colors?: Record<string, string>
  boolean?: boolean
}
export type ImageColumnDefinition = TableColumnBase & {
  kind: 'image'
  circular?: boolean
  stacked?: boolean
}
export type ColorColumnDefinition = TableColumnBase & { kind: 'color' }
export type CustomColumnDefinition = TableColumnBase & { kind: 'custom'; component: string }
export type FragmentColumnDefinition = { kind: 'fragment'; component: string }
export type TableColumnDefinition =
  | TextColumnDefinition
  | BadgeColumnDefinition
  | IconColumnDefinition
  | ImageColumnDefinition
  | ColorColumnDefinition
  | CustomColumnDefinition
  | FragmentColumnDefinition
export type SelectFilterDefinition = {
  kind: 'select'
  name: string
  options?: Record<string, unknown>
  multiple?: boolean
  attribute?: string
}
export type TernaryFilterDefinition = {
  kind: 'ternary'
  name: string
  trueLabel?: string
  falseLabel?: string
  attribute?: string
}
export type DateRangeFilterDefinition = { kind: 'dateRange'; name: string; attribute?: string }
export type CustomFilterDefinition = {
  kind: 'custom'
  name: string
  form?: readonly SchemaNodeDefinition[]
  query?: (query: ModelQueryBuilderContract<LucidModel>, data: Record<string, unknown>) => unknown
}
export type TableFilterDefinition =
  | SelectFilterDefinition
  | TernaryFilterDefinition
  | DateRangeFilterDefinition
  | CustomFilterDefinition
export type TableEmptyStateDefinition = {
  heading: string
  description?: string
  icon?: string
  action?: ActionDefinition
}
export type TableEmptyStateInput = Omit<TableEmptyStateDefinition, 'action'> & {
  action?: ActionBuilder | ActionDefinition
}
export type TableDefinition = {
  query?: QueryCallback
  defaultSort?: { column: string; direction: 'asc' | 'desc' }
  columns: TableColumnDefinition[]
  filters: TableFilterDefinition[]
  filtersLayout: 'dropdown' | 'above' | 'slideover'
  searchDebounce: number
  paginated: readonly (number | 'all')[] | false
  striped: boolean
  recordUrl?: ((args: { record: unknown }) => string) | false
  emptyState?: TableEmptyStateDefinition
}
export interface TableSchema {
  columns(value: readonly TableColumnBuilderUnion[]): this
  filters(value: readonly TableFilterBuilderUnion[]): this
  query(value: QueryCallback): this
  defaultSort(column: string, direction: 'asc' | 'desc'): this
  filtersLayout(value: TableDefinition['filtersLayout']): this
  searchDebounce(value: number): this
  paginated(value: TableDefinition['paginated']): this
  striped(value?: boolean): this
  recordUrl(value: NonNullable<TableDefinition['recordUrl']> | false): this
  emptyState(value: TableEmptyStateInput): this
  toDefinition(): TableDefinition
}
export interface TableColumnBuilder<D extends TableColumnDefinition> {
  readonly definition: D
  toDefinition(): D
}
export interface TextColumnBuilder extends TableColumnBuilder<TextColumnDefinition> {
  searchable(value?: boolean): this
  sortable(value?: boolean): this
  limit(value: number): this
  wrap(value?: boolean): this
  description(value: NonNullable<TextColumnDefinition['description']>): this
  badge(value?: boolean): this
  money(currency: string): this
  numeric(value?: boolean): this
  dateTime(value?: boolean): this
  date(value?: boolean): this
  since(value?: boolean): this
  copyable(value?: boolean): this
  url(value: NonNullable<TextColumnDefinition['url']>): this
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
}
export interface BadgeColumnBuilder extends TableColumnBuilder<BadgeColumnDefinition> {
  searchable(value?: boolean): this
  sortable(value?: boolean): this
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
  colors(value: Record<string, string>): this
}
export interface IconColumnBuilder extends TableColumnBuilder<IconColumnDefinition> {
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
  icons(value: Record<string, string>): this
  colors(value: Record<string, string>): this
  boolean(value?: boolean): this
}
export interface ImageColumnBuilder extends TableColumnBuilder<ImageColumnDefinition> {
  label(value: string): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
  circular(value?: boolean): this
  stacked(value?: boolean): this
}
export interface ColorColumnBuilder extends TableColumnBuilder<ColorColumnDefinition> {
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
}
export interface CustomColumnBuilder extends TableColumnBuilder<CustomColumnDefinition> {
  label(value: string): this
  width(value: string): this
}
export interface FragmentColumnBuilder extends TableColumnBuilder<FragmentColumnDefinition> {}
export type TableColumnBuilderUnion =
  | TextColumnBuilder
  | BadgeColumnBuilder
  | IconColumnBuilder
  | ImageColumnBuilder
  | ColorColumnBuilder
  | CustomColumnBuilder
  | FragmentColumnBuilder
export interface TableFilterBuilder<D extends TableFilterDefinition> {
  readonly definition: D
  toDefinition(): D
}
export interface SelectFilterBuilder extends TableFilterBuilder<SelectFilterDefinition> {
  options(value: Record<string, unknown>): this
  multiple(value?: boolean): this
  attribute(value: string): this
}
export interface TernaryFilterBuilder extends TableFilterBuilder<TernaryFilterDefinition> {
  trueLabel(value: string): this
  falseLabel(value: string): this
  attribute(value: string): this
}
export interface DateRangeFilterBuilder extends TableFilterBuilder<DateRangeFilterDefinition> {
  attribute(value: string): this
}
export interface CustomFilterBuilder extends TableFilterBuilder<CustomFilterDefinition> {
  form(value: readonly SchemaNodeBuilder[]): this
  query(value: NonNullable<CustomFilterDefinition['query']>): this
}
export type TableFilterBuilderUnion =
  SelectFilterBuilder | TernaryFilterBuilder | DateRangeFilterBuilder | CustomFilterBuilder
