import { lazy, Suspense } from 'react'
import type { WidgetDescriptor } from '@rikology/pupitre/catalog'
import { t } from '@rikology/pupitre-react'
const Board = lazy(() => import('./KanbanBoardBody.js'))
export type KanbanCard = {
  id: string
  title: string
  description?: string
  url?: string
  movable: boolean
  entries: { label: string; value: string }[]
}
export type KanbanColumn = {
  value: string
  label: string
  color?: string
  count: number
  limit: number
  cards: KanbanCard[]
}
export type KanbanData = { columns: KanbanColumn[]; createUrl?: string; statusColumn: string }
export type KanbanBoardProps = { data: unknown; descriptor: WidgetDescriptor }
export function KanbanBoard(props: KanbanBoardProps) {
  return (
    <Suspense fallback={<p role="status">{t('Loading board')}</p>}>
      <Board {...props} />
    </Suspense>
  )
}
