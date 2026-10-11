import type { HttpContext } from '@adonisjs/core/http'
import type { ModelQueryBuilderContract, LucidModel } from '@adonisjs/lucid/types/model'
import type { SchemaNodeBuilder, SchemaNodeDefinition, ValidationRules } from './schema.js'
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
  individuallySearchable?: boolean
  summaries?: ('sum' | 'avg' | 'count' | 'min' | 'max' | 'range')[]
  countRelation?: string
}
export type EditableColumnBase = TableColumnBase & {
  editable: true
  disabled?: (args: { record: unknown }) => boolean
}
export type ToggleColumnDefinition = EditableColumnBase & { kind: 'toggle' }
export type CheckboxColumnDefinition = EditableColumnBase & { kind: 'checkbox' }
export type SelectColumnDefinition = EditableColumnBase & {
  kind: 'select'
  options?: Record<string, unknown>
}
export type TextInputColumnDefinition = EditableColumnBase & {
  kind: 'textInput'
  validation?: ValidationRules
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
  timezone?: string
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
  | ToggleColumnDefinition
  | CheckboxColumnDefinition
  | SelectColumnDefinition
  | TextInputColumnDefinition

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
export type TrashedFilterDefinition = { kind: 'trashed'; name: 'trashed'; column?: string }
export type DateRangeFilterDefinition = {
  kind: 'dateRange'
  name: string
  attribute?: string
  timezone?: string
}
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
  | TrashedFilterDefinition
export type TableEmptyStateDefinition = {
  heading: string
  description?: string
  icon?: string
  action?: ActionDefinition
}
export type TableGroupDefinition = {
  key: string
  label?: string
  collapsible?: boolean
}
export type TableEmptyStateInput = Omit<TableEmptyStateDefinition, 'action'> & {
  action?: ActionBuilder | ActionDefinition
}
export interface TableGroupBuilder {
  readonly definition: TableGroupDefinition
  label(value: string): TableGroupBuilder
  collapsible(value?: boolean): TableGroupBuilder
  toDefinition(): TableGroupDefinition
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
  rowClass?: (args: { record: unknown }) => string
  groups?: TableGroupDefinition[]
  defaultGroup?: string
  deferLoading?: boolean
  emptyState?: TableEmptyStateDefinition
  reorderable?: string
  poll?: string
  deferFilters?: boolean
  layout?: { type: 'grid'; columns: { default?: number; md?: number; xl?: number } }
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
  rowClass(value: NonNullable<TableDefinition['rowClass']>): this
  groups(value: readonly TableGroupBuilder[]): this
  defaultGroup(value?: string): this
  deferLoading(value?: boolean): this
  summarize(
    column: string,
    summaries: readonly NonNullable<TableColumnBase['summaries']>[number][]
  ): this
  count(relation: string): TableColumnBuilderUnion
  group(key: string): TableGroupBuilder
  emptyState(value: TableEmptyStateInput): this
  layout: {
    grid(columns: { default?: number; md?: number; xl?: number }): TableSchema
  }
  reorderable(column: string): this
  poll(interval: string): this
  deferFilters(value?: boolean): this
  toDefinition(): TableDefinition
}
export interface TableColumnBuilder<D extends TableColumnDefinition> {
  readonly definition: D
  toDefinition(): D
}
export interface TextColumnBuilder extends TableColumnBuilder<TextColumnDefinition> {
  searchable(value?: boolean | { individually?: boolean }): this
  summarize(value: readonly NonNullable<TableColumnBase['summaries']>[number][]): this
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
  timezone(value: string): this
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
export interface ToggleColumnBuilder extends TableColumnBuilder<ToggleColumnDefinition> {
  searchable(value?: boolean | { individually?: boolean }): this
  sortable(value?: boolean): this
  summarize(value: readonly NonNullable<TableColumnBase['summaries']>[number][]): this
  disabled(value: NonNullable<ToggleColumnDefinition['disabled']>): this
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
}
export interface CheckboxColumnBuilder extends TableColumnBuilder<CheckboxColumnDefinition> {
  searchable(value?: boolean | { individually?: boolean }): this
  sortable(value?: boolean): this
  summarize(value: readonly NonNullable<TableColumnBase['summaries']>[number][]): this
  disabled(value: NonNullable<CheckboxColumnDefinition['disabled']>): this
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
}
export interface SelectColumnBuilder extends TableColumnBuilder<SelectColumnDefinition> {
  searchable(value?: boolean | { individually?: boolean }): this
  sortable(value?: boolean): this
  summarize(value: readonly NonNullable<TableColumnBase['summaries']>[number][]): this
  disabled(value: NonNullable<SelectColumnDefinition['disabled']>): this
  options(value: Record<string, unknown>): this
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
}
export interface TextInputColumnBuilder extends TableColumnBuilder<TextInputColumnDefinition> {
  searchable(value?: boolean | { individually?: boolean }): this
  sortable(value?: boolean): this
  summarize(value: readonly NonNullable<TableColumnBase['summaries']>[number][]): this
  disabled(value: NonNullable<TextInputColumnDefinition['disabled']>): this
  validation(value: NonNullable<TextInputColumnDefinition['validation']>): this
  label(value: string): this
  alignment(value: NonNullable<TableColumnBase['alignment']>): this
  width(value: string): this
  toggleable(value?: NonNullable<TableColumnBase['toggleable']>): this
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
  | ToggleColumnBuilder
  | CheckboxColumnBuilder
  | SelectColumnBuilder
  | TextInputColumnBuilder
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
  timezone(value: string): this
}
export interface CustomFilterBuilder extends TableFilterBuilder<CustomFilterDefinition> {
  form(value: readonly SchemaNodeBuilder[]): this
  query(value: NonNullable<CustomFilterDefinition['query']>): this
}
export interface TrashedFilterBuilder extends TableFilterBuilder<TrashedFilterDefinition> {}
export type TableFilterBuilderUnion =
  | SelectFilterBuilder
  | TernaryFilterBuilder
  | DateRangeFilterBuilder
  | CustomFilterBuilder
  | TrashedFilterBuilder
