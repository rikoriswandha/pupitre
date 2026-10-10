import type { EntryProps } from './EntryShell.js'
import { EntryShell } from './EntryShell.js'

function imageUrls(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (value && typeof value === 'object' && 'url' in value && typeof value.url === 'string')
    return [value.url]
  return []
}

export function ImageEntry({ props = {} }: { props?: EntryProps }) {
  const urls = imageUrls(props.value)
  return (
    <EntryShell label={props.label} columnSpan={props.columnSpan}>
      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <img
              key={url}
              src={url}
              alt={props.label ?? ''}
              className="max-h-48 max-w-full rounded-md border border-border object-contain"
            />
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
