import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { stableJson } from '../definition/shared.js'
import type { TimelineItem, WidgetDefinition, WidgetStat } from '../definition/widget.js'
import { Table } from './table/table.js'
import type { TableDefinition, TableSchema } from '../definition/table.js'
import type { ActionBuilder } from '../definition/action.js'

export type StatBuilder = {
  readonly definition: WidgetStat
  description(value: string): StatBuilder
  descriptionIcon(value: string): StatBuilder
  color(value: string): StatBuilder
  chart(value: number[]): StatBuilder
  toDefinition(): WidgetStat
}

class Stat implements StatBuilder {
  constructor(readonly definition: WidgetStat) {}

  private update(patch: Partial<WidgetStat>) {
    return new Stat({ ...this.definition, ...patch })
  }

  description(value: string) {
    return this.update({ description: value })
  }
  descriptionIcon(value: string) {
    return this.update({ descriptionIcon: value })
  }
  color(value: string) {
    return this.update({ color: value })
  }
  chart(value: number[]) {
    return this.update({ chart: [...value] })
  }
  toDefinition() {
    return this.definition
  }
}

export function stat(label: string, value: string | number): StatBuilder {
  return new Stat({ label, value })
}

type ChartData = { labels: string[]; datasets: { label: string; data: number[]; color?: string }[] }
type ScatterData = {
  datasets: { label: string; data: { x: number; y: number }[]; color?: string }[]
}
type ChartResult<T> = T extends 'scatter' ? ScatterData : ChartData
type WidgetContext = { ctx: HttpContext; filters: Record<string, unknown>; record?: unknown }
type StatInput = WidgetStat | StatBuilder

export type WidgetBuilder = {
  readonly definition: WidgetDefinition
  stats(callback: (args: WidgetContext) => StatInput[] | Promise<StatInput[]>): WidgetBuilder
  timeline(
    callback: (args: WidgetContext) => TimelineItem[] | Promise<TimelineItem[]>
  ): WidgetBuilder
  chart<T extends NonNullable<WidgetDefinition['chartType']>>(
    type: T,
    callback: (args: WidgetContext) => ChartResult<T> | Promise<ChartResult<T>>
  ): WidgetBuilder
  table(callback: (schema: TableSchema) => TableSchema): WidgetBuilder
  component(value: string, loader?: NonNullable<WidgetDefinition['load']>): WidgetBuilder
  actions(value: readonly ActionBuilder[]): WidgetBuilder
  span(value: number | 'full'): WidgetBuilder
  sort(value: number): WidgetBuilder
  poll(value: string): WidgetBuilder
  heading(value: string): WidgetBuilder
  description(value: string): WidgetBuilder
  canView(value: NonNullable<WidgetDefinition['canView']>): WidgetBuilder
  lazy(value: boolean): WidgetBuilder
  toDefinition(): WidgetDefinition
  toJSON(): string
}

class Widget implements WidgetBuilder {
  constructor(
    readonly definition: WidgetDefinition,
    private readonly explicitSpan = false
  ) {}

  private change(
    patch: Partial<WidgetDefinition>,
    explicitSpan = this.explicitSpan
  ): WidgetBuilder {
    const next = { ...this.definition, ...patch }
    next.toJSON = () =>
      stableJson(Object.fromEntries(Object.entries(next).filter(([key]) => key !== 'toJSON')))
    return new Widget(next, explicitSpan)
  }

  stats(callback: (args: WidgetContext) => StatInput[] | Promise<StatInput[]>) {
    return this.change({
      kind: 'stats',
      // Like Filament's StatsOverviewWidget, a stats row spans the dashboard unless sized explicitly.
      ...(this.explicitSpan ? {} : { span: 'full' as const }),
      load: async (args) => {
        const stats = await callback(args)
        return stats.map((item) => ('toDefinition' in item ? item.toDefinition() : item))
      },
    })
  }

  timeline(callback: (args: WidgetContext) => TimelineItem[] | Promise<TimelineItem[]>) {
    return this.change({ kind: 'timeline', load: callback })
  }

  chart<T extends NonNullable<WidgetDefinition['chartType']>>(
    type: T,
    callback: (args: WidgetContext) => ChartResult<T> | Promise<ChartResult<T>>
  ) {
    return this.change({ kind: 'chart', chartType: type, load: callback })
  }

  table(callback: (schema: TableSchema) => TableSchema) {
    const initial: TableDefinition = {
      columns: [],
      filters: [],
      filtersLayout: 'dropdown',
      searchDebounce: 300,
      paginated: [10, 25, 50],
      striped: false,
    }
    const schema = callback(new Table(initial))
    return this.change({ kind: 'table', table: schema.toDefinition() })
  }

  component(value: string, loader?: NonNullable<WidgetDefinition['load']>) {
    return this.change({ kind: 'component', component: value, load: loader })
  }
  actions(value: readonly ActionBuilder[]) {
    return this.change({ actions: value.map((item) => item.definition) })
  }
  span(value: number | 'full') {
    return this.change({ span: value }, true)
  }
  sort(value: number) {
    return this.change({ sort: value })
  }
  poll(value: string) {
    return this.change({ poll: value })
  }
  heading(value: string) {
    return this.change({ heading: value })
  }
  description(value: string) {
    return this.change({ description: value })
  }
  canView(value: NonNullable<WidgetDefinition['canView']>) {
    return this.change({ canView: value })
  }
  lazy(value: boolean) {
    return this.change({ lazy: value })
  }
  toDefinition() {
    return this.definition
  }
  toJSON() {
    return this.definition.toJSON()
  }
}

export function defineWidget(name: string, model?: LucidModel): WidgetBuilder {
  const definition: WidgetDefinition = {
    name,
    ...(model ? { model } : {}),
    kind: 'stats',
    span: 1,
    sort: 0,
    lazy: true,
    toJSON: () => '',
  }
  definition.toJSON = () =>
    stableJson(Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'toJSON')))
  return new Widget(definition)
}
