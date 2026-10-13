export { configure } from './configure.js'
import type { HttpContext } from '@adonisjs/core/http'
import { createError } from '@adonisjs/core/exceptions'
import type { LucidRow } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import {
  action,
  authorizeResource,
  definePlugin,
  defineWidget,
  parseInZone,
  schema,
  scopedQuery,
  toIsoInZone,
  t,
  E_PUPITRE_FORBIDDEN,
} from '@rikology/pupitre'
import type {
  CustomPageBuilder,
  ResourceBuilder,
  ResourceDefinition,
  ResourceModel,
  ResourceRuntime,
  WidgetBuilder,
  WidgetDefinition,
} from '@rikology/pupitre'

export type CalendarView = 'month' | 'week' | 'day' | 'list'
export interface CalendarEvent {
  id: string | number
  title: string
  start: string
  end?: string
  allDay?: boolean
  color?: string
  url?: string
  editable?: boolean
}
export interface CalendarRange {
  start: string
  end: string
  ctx: HttpContext
  filters: Record<string, unknown>
}
export interface CalendarMove {
  id: string | number
  start: string
  end?: string
  allDay: boolean
  ctx: HttpContext
}
export interface CalendarEditable {
  move: (args: CalendarMove) => void | Promise<void>
  can?: (ctx: HttpContext, event: CalendarEvent) => boolean | Promise<boolean>
}
export type CalendarLoader = (args: CalendarRange) => CalendarEvent[] | Promise<CalendarEvent[]>
export const E_PUPITRE_CALENDAR_INVALID = createError(
  'Invalid calendar dates',
  'E_PUPITRE_CALENDAR_INVALID',
  422
)
export const E_PUPITRE_CALENDAR_NOT_FOUND = createError(
  'Calendar event not found',
  'E_PUPITRE_CALENDAR_NOT_FOUND',
  404
)

export function calendarDates(start: string, end: string | undefined, timezone: string) {
  const from = parseInZone(start, timezone)
  const until = end ? parseInZone(end, timezone) : null
  if (!from || (end && (!until || until <= from))) throw new E_PUPITRE_CALENDAR_INVALID()
  return { start: from, end: until }
}

export interface ResourceEventsOptions {
  start: string
  end?: string
  title?: string
  color?: string | ((record: LucidRow) => string | undefined)
}
export type ResourceCalendarLoader = CalendarLoader & CalendarEditable
function runtime(ctx: HttpContext, definition: ResourceDefinition): ResourceRuntime {
  const resource = ctx.pupitre.panel.resources.find(
    (candidate) =>
      candidate.slug === definition.slug && candidate.definition.model === definition.model
  )
  if (!resource || resource.parent) throw new E_PUPITRE_CALENDAR_NOT_FOUND()
  return resource
}
function attribute(resource: ResourceRuntime, name: string) {
  resource.model.boot()
  const entries = [...resource.model.$columnsDefinitions.entries()]
  const match = entries.find(([key, column]) => key === name || column.columnName === name)
  if (!match) throw new Error(`Calendar attribute "${name}" is not a model column`)
  return { property: match[0], column: match[1].columnName }
}

/** Resource policy and tenant scope are evaluated again on every read and move. */
export function resourceEvents(
  resource: ResourceBuilder<ResourceModel> | ResourceDefinition,
  options: ResourceEventsOptions
): ResourceCalendarLoader {
  const definition = 'toDefinition' in resource ? resource.toDefinition() : resource
  const load: CalendarLoader = async ({ ctx, start, end }) => {
    const resolved = runtime(ctx, definition)
    if (!(await authorizeResource(ctx, resolved, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
    const dates = calendarDates(start, end, ctx.pupitre.timezone)
    if (!dates.end) throw new E_PUPITRE_CALENDAR_INVALID()
    const from = attribute(resolved, options.start)
    const until = options.end ? attribute(resolved, options.end) : undefined
    const title = attribute(resolved, options.title ?? definition.recordTitle ?? 'title')
    const query = scopedQuery(ctx, resolved).where(from.column, '<', dates.end!.toSQL()!)
    if (until)
      query.where((overlap) =>
        overlap
          .where(until.column, '>', dates.start.toSQL()!)
          .orWhere((point) =>
            point.whereNull(until.column).where(from.column, '>=', dates.start.toSQL()!)
          )
      )
    else query.where(from.column, '>=', dates.start.toSQL()!)
    const records = await query.orderBy(from.column, 'asc')
    const events: CalendarEvent[] = []
    for (const record of records) {
      const values = record as unknown as Record<string, string | DateTime | null>
      const visible = await authorizeResource(ctx, resolved, 'view', record)
      const editable = await authorizeResource(ctx, resolved, 'update', record)
      const iso = toIsoInZone(values[from.property], ctx.pupitre.timezone)
      if (!iso) continue
      const endIso = until ? toIsoInZone(values[until.property], ctx.pupitre.timezone) : null
      const id = String(record.$primaryKeyValue)
      events.push({
        id,
        title: String(values[title.property] ?? ''),
        start: iso,
        ...(endIso ? { end: endIso } : {}),
        editable,
        ...(options.color
          ? { color: typeof options.color === 'function' ? options.color(record) : options.color }
          : {}),
        ...(visible && resolved.definition.pages.view
          ? { url: resolved.urls.view(id) }
          : visible && editable && resolved.definition.pages.edit
            ? { url: resolved.urls.edit(id) }
            : {}),
      })
    }
    return events
  }
  return Object.assign(load, {
    can: (_ctx: HttpContext, event: CalendarEvent) => event.editable === true,
    move: async ({ ctx, id, start, end }: CalendarMove) => {
      const resolved = runtime(ctx, definition)
      if (!(await authorizeResource(ctx, resolved, 'viewAny'))) throw new E_PUPITRE_FORBIDDEN()
      let record: LucidRow | null
      try {
        record = await scopedQuery(ctx, resolved).where(resolved.model.primaryKey, id).first()
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '22P02')
          throw new E_PUPITRE_CALENDAR_NOT_FOUND()
        throw error
      }
      if (!record) throw new E_PUPITRE_CALENDAR_NOT_FOUND()
      if (!(await authorizeResource(ctx, resolved, 'update', record)))
        throw new E_PUPITRE_FORBIDDEN()
      const dates = calendarDates(start, end, ctx.pupitre.timezone)
      const from = attribute(resolved, options.start)
      const until = options.end ? attribute(resolved, options.end) : undefined
      record.merge({
        [from.property]: dates.start,
        ...(until ? { [until.property]: dates.end } : {}),
      })
      await record.save()
    },
  })
}

interface CalendarOptions {
  loader?: CalendarLoader
  views: CalendarView[]
  initialView: CalendarView
  firstDayOfWeek: number
  editable?: CalendarEditable
}
export class CalendarWidget {
  constructor(
    private readonly widget: WidgetBuilder,
    private readonly options: CalendarOptions
  ) {}
  private change(patch: Partial<CalendarOptions>) {
    return new CalendarWidget(this.widget, { ...this.options, ...patch })
  }
  events(loader: CalendarLoader) {
    return this.change({
      loader,
      ...('move' in loader ? { editable: loader as ResourceCalendarLoader } : {}),
    })
  }
  views(views: CalendarView[]) {
    if (!views.length || views.some((view) => !['month', 'week', 'day', 'list'].includes(view)))
      throw new Error('Invalid calendar views')
    return this.change({
      views: [...new Set(views)],
      initialView: views.includes(this.options.initialView) ? this.options.initialView : views[0],
    })
  }
  initialView(view: CalendarView) {
    if (!this.options.views.includes(view)) throw new Error('Initial calendar view must be enabled')
    return this.change({ initialView: view })
  }
  firstDayOfWeek(day: number) {
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('First day must be 0–6')
    return this.change({ firstDayOfWeek: day })
  }
  editable(editable: CalendarEditable) {
    return this.change({ editable })
  }
  heading(value: string) {
    return new CalendarWidget(this.widget.heading(value), this.options)
  }
  description(value: string) {
    return new CalendarWidget(this.widget.description(value), this.options)
  }
  span(value: number | 'full') {
    return new CalendarWidget(this.widget.span(value), this.options)
  }
  sort(value: number) {
    return new CalendarWidget(this.widget.sort(value), this.options)
  }
  canView(value: NonNullable<WidgetDefinition['canView']>) {
    return new CalendarWidget(this.widget.canView(value), this.options)
  }
  lazy(value: boolean) {
    return new CalendarWidget(this.widget.lazy(value), this.options)
  }
  poll(value: string) {
    return new CalendarWidget(this.widget.poll(value), this.options)
  }
  toDefinition(): WidgetDefinition {
    const options = this.options
    if (!options.loader) throw new Error('Calendar requires an events loader')
    const loader = options.loader
    let widget = this.widget.component('Calendar', async ({ ctx, filters }) => {
      const now = DateTime.now().setZone(ctx.pupitre.timezone)
      const start =
        typeof filters.start === 'string'
          ? filters.start
          : now.startOf('month').minus({ days: 7 }).toISO()!
      const end =
        typeof filters.end === 'string'
          ? filters.end
          : now.endOf('month').plus({ days: 8 }).toISO()!
      const dates = calendarDates(start, end, ctx.pupitre.timezone)
      if (!dates.end) throw new E_PUPITRE_CALENDAR_INVALID()
      const events = await loader({
        ctx,
        filters,
        start: dates.start.toISO()!,
        end: dates.end!.toISO()!,
      })
      return {
        events: await Promise.all(
          events.map(async (event) => ({
            ...event,
            editable: Boolean(
              options.editable &&
              (options.editable.can ? await options.editable.can(ctx, event) : true)
            ),
          }))
        ),
        views: options.views,
        initialView: options.initialView,
        firstDayOfWeek: options.firstDayOfWeek,
        timezone: ctx.pupitre.timezone,
        editable: Boolean(options.editable),
      }
    })
    if (options.editable) {
      const editable = options.editable
      widget = widget.actions([
        action('reschedule')
          .label(t('Move event'))
          .form([
            schema.text('id').required(),
            schema.text('start').required(),
            schema.text('end').required(false).nullable(),
            schema.checkbox('allDay'),
          ])
          .handle(async ({ ctx, data }) => {
            if (!ctx || !data) throw new E_PUPITRE_FORBIDDEN()
            const start = String(data.start)
            const end = data.end ? String(data.end) : undefined
            calendarDates(start, end, ctx.pupitre.timezone)
            if (editable.can && editable !== (loader as unknown)) {
              const filters = ctx.request.qs()
              const now = DateTime.now().setZone(ctx.pupitre.timezone)
              const rangeStart =
                typeof filters.start === 'string'
                  ? filters.start
                  : now.startOf('month').minus({ days: 7 }).toISO()!
              const rangeEnd =
                typeof filters.end === 'string'
                  ? filters.end
                  : now.endOf('month').plus({ days: 8 }).toISO()!
              const events = await loader({ ctx, filters, start: rangeStart, end: rangeEnd })
              const event = events.find((item) => String(item.id) === String(data.id))
              if (!event || !(await editable.can(ctx, event))) throw new E_PUPITRE_FORBIDDEN()
            }
            await editable.move({
              ctx,
              id: String(data.id),
              start,
              end,
              allDay: data.allDay === true,
            })
          }),
      ])
    }
    const definition = widget.toDefinition()
    return {
      ...definition,
      toJSON: () =>
        JSON.stringify({
          widget: definition.toJSON(),
          views: options.views,
          initialView: options.initialView,
          firstDayOfWeek: options.firstDayOfWeek,
        }),
    }
  }
  get definition() {
    return this.toDefinition()
  }
  toJSON() {
    return this.toDefinition().toJSON()
  }
}
export function calendarWidget(name: string) {
  return new CalendarWidget(defineWidget(name).span('full'), {
    views: ['month', 'week', 'day', 'list'],
    initialView: 'month',
    firstDayOfWeek: 1,
  })
}
export function calendar(options: { pages: CustomPageBuilder[] }) {
  return definePlugin({ name: 'calendar', pages: options.pages.map((page) => page.toDefinition()) })
}
