import type { ComponentType } from 'react'
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
function widgetSpanClass(span: number | 'full') {
  if (span === 'full') return 'col-span-full'
  const normalized = Math.max(1, Math.min(4, Math.floor(span)))
  if (normalized === 1) return ''
  const xlSpan = { 2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4' }[normalized]
  return `md:col-span-2 ${xlSpan}`
}
function WidgetSkeleton({ span }: { span: number | 'full' }) {
  return (
    <div
      aria-busy="true"
      className={`min-h-32 animate-pulse rounded-xl border border-border bg-muted motion-reduce:animate-none ${widgetSpanClass(span)}`}
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
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-4">
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
                  options={[{ value: '', label: t('All') }, ...filter.options]}
                />
              </div>
            )
          })}
        </div>
      )}
      {widgets.map((widget) => {
        const value = widgetData[widget.dataProp] as WidgetData | undefined
        if (deferred.includes(widget.dataProp) && !value)
          return <WidgetSkeleton key={widget.name} span={widget.span} />
        const Custom = widget.component ? customWidgets[widget.component] : undefined
        const span = widgetSpanClass(widget.span)
        return (
          <div key={widget.name} className={span}>
            {widget.kind === 'stats' ? <WidgetStats descriptor={widget} data={value} /> : null}
            {widget.kind === 'chart' ? <WidgetChart descriptor={widget} data={value} /> : null}
            {widget.kind === 'table' ? <WidgetTable descriptor={widget} data={value} /> : null}
            {widget.kind === 'timeline' ? (
              <WidgetTimeline descriptor={widget} data={value} />
            ) : null}
            {widget.kind === 'component' && Custom ? (
              <Custom descriptor={widget} data={widgetData[widget.dataProp]} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
