import { useLayoutEffect, useRef, useState } from 'react'
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { t, useToast, useWidget } from '@rikology/pupitre-react'
import type { KanbanBoardProps, KanbanCard, KanbanColumn, KanbanData } from './KanbanBoard.js'

function Card({ card, busy }: { card: KanbanCard; busy: boolean }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isOver } =
    useSortable({ id: `card:${card.id}`, disabled: busy || !card.movable })
  return (
    <article
      data-pupitre-kanban-card=""
      ref={setNodeRef}
      data-over={isOver}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm"
    >
      <div className="flex items-start gap-2">
        {card.movable && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-disabled={busy}
            data-card-handle={card.id}
            aria-label={t('Move {title}', { title: card.title })}
            className="min-h-8 min-w-8 rounded border border-border focus-visible:outline-2 focus-visible:outline-primary"
          >
            ⠿
          </button>
        )}
        <div className="min-w-0 flex-1">
          {card.url ? (
            <a className="font-medium underline" href={card.url}>
              {card.title}
            </a>
          ) : (
            <p className="font-medium">{card.title}</p>
          )}
          {card.description && (
            <p className="mt-1 break-words text-sm text-muted-foreground">{card.description}</p>
          )}
        </div>
      </div>
      {!!card.entries.length && (
        <dl className="mt-2 text-sm">
          {card.entries.map((entry) => (
            <div key={entry.label} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
function Column({
  column,
  busy,
  createUrl,
  more,
}: {
  column: KanbanColumn
  busy: boolean
  createUrl?: string
  more: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.value}` })
  return (
    <section
      data-pupitre-kanban-column=""
      ref={setNodeRef}
      aria-label={column.label}
      data-over={isOver}
      className="flex w-72 shrink-0 flex-col gap-3 border-t border-rule text-foreground data-[over=true]:bg-muted/40"
    >
      <h2 className="flex items-center justify-between gap-2 pt-3 pb-4 text-[0.9375rem] font-semibold">
        <span className="flex items-center gap-2">
          {column.color && (
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: column.color }}
            />
          )}
          {column.label}
        </span>
        <span className="text-sm text-muted-foreground">{column.count}</span>
      </h2>
      {createUrl && (
        <a
          href={`${createUrl}?kanbanStatus=${encodeURIComponent(column.value)}`}
          className="rounded border border-border bg-background px-3 py-2 text-center text-sm"
        >
          {t('Create in {column}', { column: column.label })}
        </a>
      )}
      <SortableContext
        items={column.cards.map((card) => `card:${card.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-24 flex-col gap-2">
          {column.cards.map((card) => (
            <Card key={card.id} card={card} busy={busy} />
          ))}
          {!column.cards.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('No cards in this column')}
            </p>
          )}
        </div>
      </SortableContext>
      {column.cards.length < column.count && (
        <button
          disabled={busy}
          type="button"
          onClick={more}
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          {t('Load more')}
        </button>
      )}
    </section>
  )
}
export default function KanbanBoardBody({ data: initial, descriptor }: KanbanBoardProps) {
  const { data, reload, runAction } = useWidget<KanbanData>(descriptor, initial as KanbanData)
  const [optimistic, setOptimistic] = useState<{ base: KanbanData; value: KanbanData } | null>(null)
  const board = optimistic?.base === data ? optimistic.value : data
  const setBoard = (value: KanbanData) => setOptimistic({ base: data, value })
  const [busy, setBusy] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const focusId = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!focusId.current) return
    const handles = boardRef.current?.querySelectorAll<HTMLButtonElement>('[data-card-handle]')
    Array.from(handles ?? [])
      .find((handle) => handle.dataset.cardHandle === focusId.current)
      ?.focus()
    if (!busy) focusId.current = null
  }, [board, busy])
  const toast = useToast()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      scrollBehavior: 'auto',
      coordinateGetter: (event, args) => {
        if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight')
          return sortableKeyboardCoordinates(event, args)
        event.preventDefault()
        const over = args.context.over?.id ?? args.active
        const current = board.columns.findIndex(
          (column) =>
            `column:${column.value}` === over ||
            column.cards.some((card) => `card:${card.id}` === over)
        )
        const next = board.columns[current + (event.code === 'ArrowRight' ? 1 : -1)]
        const rect = next && args.context.droppableRects.get(`column:${next.value}`)
        const collision = args.context.collisionRect
        if (!rect || !collision) return
        return {
          x: args.currentCoordinates.x + rect.left - collision.left,
          y: args.currentCoordinates.y + rect.top - collision.top + 50,
        }
      },
    })
  )
  async function move(event: DragEndEvent) {
    if (!event.over || busy) return
    const id = String(event.active.id).slice(5)
    const source = board.columns.find((column) => column.cards.some((card) => card.id === id))
    const destination = board.columns.find(
      (column) =>
        `column:${column.value}` === event.over!.id ||
        column.cards.some((card) => `card:${card.id}` === event.over!.id)
    )
    const card = source?.cards.find((item) => item.id === id)
    if (!source || !destination || !card || !card.movable) return
    const position = String(event.over.id).startsWith('column:')
      ? destination.cards.length
      : destination.cards.findIndex((item) => `card:${item.id}` === event.over!.id)
    const before = board
    if (event.activatorEvent instanceof KeyboardEvent) focusId.current = id
    setBoard({
      ...board,
      columns: board.columns.map((column) => {
        const cards = column.cards.filter((item) => item.id !== id)
        if (column === destination) cards.splice(Math.min(position, cards.length), 0, card)
        return {
          ...column,
          cards,
          count:
            column.count +
            (source !== destination
              ? column === source
                ? -1
                : column === destination
                  ? 1
                  : 0
              : 0),
        }
      }),
    })
    setBusy(true)
    try {
      await runAction('move', { id, status: destination.value, position })
    } catch {
      setBoard(before)
      toast({ type: 'error', title: t('Unable to move card. Changes were restored.') })
      setBusy(false)
      return
    }
    try {
      const refreshed = await reload(
        Object.fromEntries(
          before.columns.map((column) => [`kanbanLimit_${column.value}`, column.limit])
        )
      )
      setBoard(refreshed)
    } catch {
      toast({ type: 'error', title: t('Unable to load board') })
    } finally {
      setBusy(false)
    }
  }
  function dragLocation(activeId: string | number, overId: string | number = activeId) {
    const source = board.columns.find((column) =>
      column.cards.some((card) => `card:${card.id}` === activeId)
    )
    const card = source?.cards.find((item) => `card:${item.id}` === activeId)
    const column = board.columns.find(
      (item) =>
        `column:${item.value}` === overId ||
        item.cards.some((itemCard) => `card:${itemCard.id}` === overId)
    )
    if (!card || !column) return null
    const position = String(overId).startsWith('column:')
      ? column.cards.filter((item) => item.id !== card.id).length + 1
      : column.cards.findIndex((item) => `card:${item.id}` === overId) + 1
    return { card: card.title, column: column.label, position }
  }
  if (!board) return <p role="status">{t('Loading board')}</p>
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={move}
      accessibility={{
        screenReaderInstructions: {
          draggable: t(
            'Press space to pick up a card, use arrow keys to move, and press space to drop. Press escape to cancel.'
          ),
        },
        announcements: {
          onDragStart: ({ active }) => {
            const location = dragLocation(active.id)
            return location
              ? t('{card} picked up in {column} at position {position}', location)
              : undefined
          },
          onDragOver: ({ active, over }) => {
            const location = over && dragLocation(active.id, over.id)
            return location
              ? t('{card} is over {column} at position {position}', location)
              : t('Card outside drop targets')
          },
          onDragEnd: ({ active, over }) => {
            const location = over && dragLocation(active.id, over.id)
            return location
              ? t('{card} dropped in {column} at position {position}', location)
              : t('Card move cancelled')
          },
          onDragCancel: () => t('Card move cancelled'),
        },
      }}
    >
      <div
        data-pupitre-kanban=""
        ref={boardRef}
        aria-busy={busy}
        className="flex max-w-full gap-4 overflow-x-auto pb-4"
        data-testid="kanban-board"
      >
        {board.columns.map((column) => (
          <Column
            key={column.value}
            column={column}
            busy={busy}
            createUrl={board.createUrl}
            more={() => {
              setBusy(true)
              void reload(
                Object.fromEntries(
                  board.columns.map((item) => [
                    `kanbanLimit_${item.value}`,
                    item.limit + (item === column ? 25 : 0),
                  ])
                )
              )
                .then(setBoard)
                .catch(() => toast({ type: 'error', title: t('Unable to load board') }))
                .finally(() => setBusy(false))
            }}
          />
        ))}
      </div>
    </DndContext>
  )
}
