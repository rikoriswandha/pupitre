import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from './Modal.js'
import type { WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t, useWidget } from '@rikology/pupitre-react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Button, CheckboxControl, Input, cn, controlClasses } from '../primitives/index.js'
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
export interface CalendarData {
  events: CalendarEvent[]
  views: CalendarView[]
  initialView: CalendarView
  firstDayOfWeek: number
  timezone: string
  editable: boolean
}
const dayMillis = 86400000
const viewLabels = {
  month: () => t('Month'),
  week: () => t('Week'),
  day: () => t('Day'),
  list: () => t('Agenda'),
}
/** A UTC-shaped Date representing wall-clock fields, never a persisted instant. */
export function calendarWall(value: string, timezone: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return new Date(`${value}Z`)
  const fields = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value])
  )
  return new Date(
    `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}Z`
  )
}
function EventCard({
  event,
  timezone,
  draggable,
  slot,
  move,
}: {
  event: CalendarEvent
  timezone: string
  draggable: boolean
  slot: string
  move: (event: CalendarEvent) => void
}) {
  const { setNodeRef, isDragging, listeners } = useDraggable({
    id: JSON.stringify([event.id, slot]),
    data: { eventId: event.id },
    disabled: !event.editable || !draggable,
  })
  return (
    <div
      ref={setNodeRef}
      className="mb-1 rounded border border-border bg-background p-1 text-sm text-foreground"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <span
        aria-hidden="true"
        className="mr-1 inline-block size-2 rounded-full"
        style={{ backgroundColor: event.color ?? 'currentColor' }}
      />
      {event.url && /^(\/[^/]|https?:\/\/)/.test(event.url) ? (
        <a className="underline" href={event.url}>
          {event.title}
        </a>
      ) : (
        <span>{event.title}</span>
      )}
      <div className="text-xs">
        {event.allDay
          ? t('All day')
          : calendarWall(event.start, timezone).toISOString().slice(11, 16)}
      </div>
      {event.editable && (
        <div className="flex gap-1">
          <Button
            size="xs"
            variant="outline"
            aria-label={t('Move {event}', { event: event.title })}
            onClick={() => move(event)}
          >
            {t('Move')}
          </Button>
          {draggable && (
            <span
              data-calendar-drag=""
              tabIndex={-1}
              aria-hidden="true"
              className="inline-flex min-h-6 cursor-grab items-center rounded px-2 text-xs"
              {...listeners}
            >
              {t('Drag')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
function CalendarCell({
  date,
  hour,
  agenda = false,
  children,
}: {
  agenda?: boolean
  date: Date
  hour?: number
  children: ReactNode
}) {
  const key = `${date.toISOString().slice(0, 10)}T${String(hour ?? 0).padStart(2, '0')}:00`
  const { setNodeRef, isOver } = useDroppable({ id: key })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        agenda ? 'min-h-12 py-2' : 'min-h-24 border-t border-l border-border p-2',
        isOver && 'bg-muted'
      )}
      data-calendar-date={key}
    >
      {children}
    </div>
  )
}
export function CalendarBody({
  descriptor,
  data: initialData,
}: {
  descriptor: WidgetDescriptor
  data: CalendarData
}) {
  const widget = useWidget<CalendarData>(descriptor, initialData)
  const data = widget.data ?? initialData
  const { reload } = widget
  const [view, setView] = useState<CalendarView>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 639px)').matches &&
    initialData.views.includes('list')
      ? 'list'
      : initialData.initialView
  )
  const [cursor, setCursor] = useState(() =>
    calendarWall(new Date().toISOString(), initialData.timezone)
  )
  const [optimisticEvents, setEvents] = useState<CalendarEvent[] | null>(null)
  const events = optimisticEvents ?? data.events
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const range = useMemo(() => {
    const first = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        view === 'month' || view === 'list' ? 1 : cursor.getUTCDate()
      )
    )
    if (view === 'month' || view === 'week')
      first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() - data.firstDayOfWeek + 7) % 7))
    const count =
      view === 'month'
        ? 42
        : view === 'week'
          ? 7
          : view === 'day'
            ? 1
            : new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate()
    return {
      first,
      end: new Date(first.getTime() + count * dayMillis),
      days: Array.from(
        { length: count },
        (_, index) => new Date(first.getTime() + index * dayMillis)
      ),
    }
  }, [cursor, view, data.firstDayOfWeek])
  const query = {
    start: range.first.toISOString().slice(0, 19),
    end: range.end.toISOString().slice(0, 19),
  }
  useEffect(() => {
    let active = true
    reload({
      start: range.first.toISOString().slice(0, 19),
      end: range.end.toISOString().slice(0, 19),
    }).catch(() => {
      if (active) setError(t('Unable to load calendar events'))
    })
    return () => {
      active = false
    }
  }, [range, reload])
  const openMove = (event: CalendarEvent) => {
    setSelected(event)
    setStart(calendarWall(event.start, data.timezone).toISOString().slice(0, 16))
    setEnd(event.end ? calendarWall(event.end, data.timezone).toISOString().slice(0, 16) : '')
    setAllDay(event.allDay ?? false)
    setError('')
  }
  const move = async (
    event: CalendarEvent,
    nextStart: string,
    nextEnd: string | undefined,
    nextAllDay: boolean
  ) => {
    setSaving(true)
    setError('')
    // Local fields remain local until the server converts them in the effective timezone.
    setEvents(
      events.map((item) =>
        item.id === event.id
          ? { ...item, start: nextStart, end: nextEnd, allDay: nextAllDay }
          : item
      )
    )
    let persisted = false
    try {
      await widget.runAction('reschedule', {
        id: String(event.id),
        start: nextStart,
        end: nextEnd,
        allDay: nextAllDay,
      })
      persisted = true
      setSelected(null)
      await widget.reload(query)
      setEvents(null)
    } catch {
      setEvents(null)
      if (persisted) setError(t('Unable to load calendar events'))
      else {
        setError(t('Unable to move event. Your changes were not saved.'))
      }
    } finally {
      setSaving(false)
    }
  }
  const shift = (direction: number) => {
    const next = new Date(cursor)
    if (view === 'month' || view === 'list') {
      next.setUTCDate(1)
      next.setUTCMonth(next.getUTCMonth() + direction)
    } else next.setUTCDate(next.getUTCDate() + direction * (view === 'week' ? 7 : 1))
    setCursor(next)
  }
  const renderEvents = (date: Date, hour?: number) =>
    events
      .filter((event) => {
        const wall = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(event.start)
          ? new Date(`${event.start}Z`)
          : calendarWall(event.start, data.timezone)
        const endWall = event.end ? calendarWall(event.end, data.timezone) : wall
        const slotStart = new Date(date.getTime() + (hour ?? 0) * 3600000)
        const slotEnd = new Date(slotStart.getTime() + (hour === undefined ? dayMillis : 3600000))
        if (event.allDay && hour !== undefined && hour !== 0) return false
        // Events without a duration occupy only their start slot; explicit ends are exclusive.
        return endWall > wall
          ? wall < slotEnd && endWall > slotStart
          : wall >= slotStart && wall < slotEnd
      })
      .map((event) => (
        <EventCard
          key={event.id}
          event={event}
          timezone={data.timezone}
          move={openMove}
          slot={`${date.toISOString()}:${hour ?? 'day'}`}
          draggable={(() => {
            const wall = calendarWall(event.start, data.timezone)
            return (
              wall.toISOString().slice(0, 10) === date.toISOString().slice(0, 10) &&
              (hour === undefined || wall.getUTCHours() === hour)
            )
          })()}
        />
      ))
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" aria-label={t('Previous period')} onClick={() => shift(-1)}>
          {t('Previous')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setCursor(calendarWall(new Date().toISOString(), data.timezone))}
        >
          {t('Today')}
        </Button>
        <Button variant="outline" aria-label={t('Next period')} onClick={() => shift(1)}>
          {t('Next')}
        </Button>
        <strong aria-live="polite">
          {cursor.toLocaleDateString(undefined, {
            timeZone: 'UTC',
            month: 'long',
            year: 'numeric',
            ...(view === 'day' ? { day: 'numeric' } : {}),
          })}
        </strong>
        <label className="ml-auto">
          {t('Calendar view')}
          <select
            className={cn(controlClasses, 'pupitre-native-select ml-2 h-(--control-h) w-auto')}
            value={view}
            onChange={(event) => setView(event.target.value as CalendarView)}
          >
            {data.views.map((item) => (
              <option key={item} value={item}>
                {viewLabels[item]()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-4 text-[0.8125rem] text-muted-foreground">
        {t('Timezone: {timezone}', { timezone: data.timezone })}
      </p>
      {error && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DndContext
        sensors={sensors}
        onDragEnd={({ active, over }) => {
          if (!over || saving) return
          const event = events.find((item) => item.id === active.data.current?.eventId)
          if (!event) return
          const next = String(over.id)
          const old = calendarWall(event.start, data.timezone)
          const target = new Date(`${next}:00Z`)
          if (view === 'month' || view === 'list')
            target.setUTCHours(old.getUTCHours(), old.getUTCMinutes())
          const duration = event.end
            ? calendarWall(event.end, data.timezone).getTime() - old.getTime()
            : undefined
          void move(
            event,
            target.toISOString().slice(0, 19),
            duration ? new Date(target.getTime() + duration).toISOString().slice(0, 19) : undefined,
            event.allDay ?? false
          )
        }}
      >
        {view === 'list' ? (
          <div aria-label={t('Agenda')} className="divide-y divide-border border-y border-border">
            {range.days.map((date) => (
              <section key={date.toISOString()} className="py-3">
                <h3 className="mb-1 text-[0.9375rem] font-semibold">
                  {date.toLocaleDateString(undefined, {
                    timeZone: 'UTC',
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h3>
                <CalendarCell date={date} agenda>
                  {renderEvents(date)}
                </CalendarCell>
              </section>
            ))}
          </div>
        ) : view === 'month' ? (
          <div className="max-w-full overflow-x-auto">
            <div
              className="grid min-w-[36rem] grid-cols-7 border-r border-b border-border"
              aria-label={t('Month')}
            >
              {range.days.slice(0, 7).map((date) => (
                <div key={date.toISOString()} className="p-1 text-center text-sm font-semibold">
                  {date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}
                </div>
              ))}
              {range.days.map((date) => (
                <CalendarCell key={date.toISOString()} date={date}>
                  <span className="text-xs">{date.getUTCDate()}</span>
                  {renderEvents(date)}
                </CalendarCell>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-h-[36rem] overflow-auto">
            <div
              className="grid min-w-[36rem]"
              style={{ gridTemplateColumns: `3rem repeat(${range.days.length}, minmax(0, 1fr))` }}
            >
              <div />
              {range.days.map((date) => (
                <div key={date.toISOString()} className="p-1 text-center text-sm font-semibold">
                  {date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </div>
              ))}
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="contents">
                  <span className="text-xs">{String(hour).padStart(2, '0')}:00</span>
                  {range.days.map((date) => (
                    <CalendarCell key={date.toISOString()} date={date} hour={hour}>
                      {renderEvents(date, hour)}
                    </CalendarCell>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </DndContext>
      {selected && (
        <Modal
          open
          heading={t('Move {event}', { event: selected.title })}
          onClose={() => {
            if (!saving) setSelected(null)
          }}
        >
          <form
            className="w-full text-foreground"
            onSubmit={(event) => {
              event.preventDefault()
              void move(selected, start, end || undefined, allDay)
            }}
          >
            <label className="mb-3 block">
              {t('Start')}
              <Input
                autoFocus
                type="datetime-local"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label className="mb-3 block">
              {t('End')}
              <Input
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
            <label className="mb-4 flex min-h-6 items-center gap-2">
              <CheckboxControl
                className="size-6"
                checked={allDay}
                onCheckedChange={(checked) => setAllDay(checked)}
              />
              {t('All day')}
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {t('Save')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                {t('Cancel')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
