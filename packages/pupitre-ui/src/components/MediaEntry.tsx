import { useEffect, useState } from 'react'
import { t, usePanel } from '@rikology/pupitre-react'
import { cn } from '../primitives/index.js'
import { batchedMediaRows, type MediaItem } from './media_protocol.js'
export type MediaEntryProps = {
  props: { value?: unknown; label?: string | null; conversion?: string }
}
/** `linked` is false in table cells, where the row link already wraps the first column. */
export function MediaEntry({ props, linked = true }: MediaEntryProps & { linked?: boolean }) {
  const { panel } = usePanel()
  const ids = (Array.isArray(props.value) ? props.value : [props.value]).filter(
    (value): value is number =>
      typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  )
  const signature = ids.join(',')
  const [rows, setRows] = useState<MediaItem[]>([])
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!signature) return
    let cancelled = false
    void batchedMediaRows(panel.path, props.conversion ?? 'thumb', signature.split(',').map(Number))
      .then((items) => {
        if (!cancelled) {
          setRows(items)
          setFailed(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([])
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [panel.path, signature, props.conversion])
  return (
    <div className="space-y-2">
      {props.label && <div className="text-sm font-medium">{props.label}</div>}
      <div className={cn('flex flex-wrap', linked ? 'gap-3' : 'gap-2')}>
        {rows
          .filter((row) => ids.includes(row.id))
          .map((row) => {
            const image = (
              <img
                src={row.url}
                alt={row.alt || row.filename}
                className="size-24 rounded object-cover"
              />
            )
            return linked ? (
              <a
                key={row.id}
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-t border-border pt-3"
              >
                {image}
              </a>
            ) : (
              <span key={row.id}>{image}</span>
            )
          })}
      </div>
      {signature && failed && <span role="alert">{t('Media request failed')}</span>}
    </div>
  )
}
