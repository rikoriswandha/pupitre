import type { ComponentType, CSSProperties } from 'react'
import { useCallback, useEffect, useState } from 'react'
import type { WidgetData, WidgetDescriptor, WidgetFilter } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
import { WidgetChart } from './WidgetChart.js'
import { WidgetStats } from './WidgetStats.js'
import { WidgetTable } from './WidgetTable.js'
import { WidgetTimeline } from './WidgetTimeline.js'
import { SelectMenu } from '../primitives/index.js'

type CustomWidget = ComponentType<{ descriptor: WidgetDescriptor; data: unknown }>
type Props = {
  widgets: WidgetDescriptor[]
  data: Record<string, unknown>
  deferred?: string[]
  filters?: WidgetFilter[]
  customWidgets?: Record<string, CustomWidget>
}
type Span = number | 'full'
/**
 * Packs widgets row by row (`columns` = 4 at xl, 2 at md) and returns each span in
 * twelfths. A row that would leave empty columns (two `span(1)` charts before a full
 * table, a lone quarter card at the end) stretches its widgets proportionally, so the
 * dashboard never shows holes. 12 divides every partial row total, so spans stay integer.
 */
function packWidgetSpans(spans: readonly Span[], columns: number): number[] {
  const twelfths: number[] = []
  let row: Array<{ index: number; span: number }> = []
  let used = 0
  const flush = () => {
    for (const item of row) twelfths[item.index] = (12 * item.span) / used
    row = []
    used = 0
  }
  spans.forEach((span, index) => {
    if (span === 'full') {
      flush()
      twelfths[index] = 12
      return
    }
    const size = Math.max(1, Math.min(columns, Math.floor(span)))
    if (used + size > columns) flush()
    row.push({ index, span: size })
    used += size
  })
  flush()
  return twelfths
}
function spanStyle(md: number, xl: number) {
  return { '--widget-md': md, '--widget-xl': xl } as CSSProperties
}
const spanClasses = 'md:col-span-(--widget-md) xl:col-span-(--widget-xl)'
function WidgetSkeleton({ style }: { style: CSSProperties }) {
  return (
    <div
      aria-busy="true"
      className={`min-h-32 animate-pulse border-t border-rule bg-muted/60 motion-reduce:animate-none ${spanClasses}`}
      style={style}
    />
  )
}
export function WidgetGrid({
  widgets,
  data,
  deferred = [],
  filters = [],
  customWidgets = {},
}: Props) {
  const [widgetData, setWidgetData] = useState(data)
  const [previousData, setPreviousData] = useState(data)
  if (previousData !== data) {
    const changedData: Record<string, unknown> = {}
    for (const widget of widgets) {
      const key = widget.dataProp
      if (!Object.is(previousData[key], data[key])) changedData[key] = data[key]
    }
    setPreviousData(data)
    // A parent may recreate the wrapper without replacing any widget prop.
    // Preserve independently polled values unless that prop itself is fresh.
    if (Object.keys(changedData).length > 0)
      setWidgetData((current) => ({ ...current, ...changedData }))
  }
  const refresh = useCallback(async (widget: WidgetDescriptor, search = window.location.search) => {
    if (!widget.dataUrl) return
    const separator = widget.dataUrl.includes('?') ? '&' : '?'
    const response = await fetch(
      `${widget.dataUrl}${search ? `${separator}${search.slice(1)}` : ''}`,
      { credentials: 'same-origin', headers: { Accept: 'application/json' } }
    )
    if (!response.ok) return
    const result = await response.json()
    setWidgetData((current) => ({ ...current, [widget.dataProp]: result }))
  }, [])
  useEffect(() => {
    const timers = widgets
      .filter((widget) => widget.poll)
      .map((widget) => window.setInterval(() => void refresh(widget), widget.poll))
    return () => timers.forEach((timer) => window.clearInterval(timer))
  }, [widgets, refresh])
  const updateFilter = (name: string, value: string) => {
    const url = new URL(window.location.href)
    const key = `filters[${name}]`
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
    for (const widget of widgets) url.searchParams.delete(`${widget.name}[page]`)
    window.history.pushState({}, '', `${url.pathname}${url.search}`)
    for (const widget of widgets) void refresh(widget, url.search)
  }
  const mdSpans = packWidgetSpans(
    widgets.map((widget) => widget.span),
    2
  )
  const xlSpans = packWidgetSpans(
    widgets.map((widget) => widget.span),
    4
  )
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-12">
      {filters.length > 0 && (
        <div className="col-span-full flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {filters.map((filter) => {
            const selected =
              typeof window === 'undefined'
                ? ''
                : (new URLSearchParams(window.location.search).get(`filters[${filter.name}]`) ?? '')
            return (
              <div
                key={filter.name}
                className="flex items-center gap-2 text-[0.8125rem] font-medium text-muted-foreground"
              >
                <span className="whitespace-nowrap">{filter.label}</span>
                <SelectMenu
                  size="sm"
                  className="w-auto min-w-28"
                  aria-label={filter.label}
                  value={selected}
                  onValueChange={(next) => updateFilter(filter.name, next)}
                  options={
                    filter.options.some((option) => option.value === '')
                      ? filter.options
                      : [{ value: '', label: t('All') }, ...filter.options]
                  }
                />
              </div>
            )
          })}
        </div>
      )}
      {widgets.map((widget, index) => {
        const value = widgetData[widget.dataProp] as WidgetData | undefined
        const style = spanStyle(mdSpans[index]!, xlSpans[index]!)
        if (deferred.includes(widget.dataProp) && !value)
          return <WidgetSkeleton key={widget.name} style={style} />
        const Custom = widget.component ? customWidgets[widget.component] : undefined
        return (
          <div key={widget.name} className={`min-w-0 ${spanClasses}`} style={style}>
            {widget.kind === 'stats' ? <WidgetStats descriptor={widget} data={value} /> : null}
            {widget.kind === 'chart' ? <WidgetChart descriptor={widget} data={value} /> : null}
            {widget.kind === 'table' ? <WidgetTable descriptor={widget} data={value} /> : null}
            {widget.kind === 'timeline' ? (
              <WidgetTimeline descriptor={widget} data={value} />
            ) : null}
            {widget.kind === 'component' && Custom ? (
              <Custom
                descriptor={widget}
                data={value?.kind === 'component' ? value.data : undefined}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
