import type { EntryDisplayProps } from './EntryShell.js'
import { cn } from '../primitives/index.js'
import { EntryShell } from './EntryShell.js'

function imageUrls(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (value && typeof value === 'object' && 'url' in value && typeof value.url === 'string')
    return [value.url]
  return []
}

export function ImageEntry({ props = {} }: { props?: EntryDisplayProps }) {
  const urls = imageUrls(props.value)
  return (
    <EntryShell
      label={props.label}
      columnSpan={props.columnSpan}
      inlineLabel={props.inlineLabel}
      empty={urls.length === 0}
    >
      {urls.length > 0 ? (
        <div className={cn('flex flex-wrap items-center', props.stacked ? '-space-x-3' : 'gap-2')}>
          {urls.map((url, index) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt={props.label ?? ''}
              className={cn(
                'max-h-48 max-w-full bg-muted ring-1 ring-border',
                props.circular || props.stacked ? 'rounded-full' : 'rounded-lg',
                props.stacked
                  ? 'size-10 object-cover ring-2 ring-card'
                  : props.circular || props.square
                    ? 'size-16 object-cover'
                    : 'object-contain'
              )}
              style={{ width: props.width, height: props.height }}
            />
          ))}
        </div>
      ) : (
        <span className="text-subtle-foreground">{props.placeholder ?? '—'}</span>
      )}
    </EntryShell>
  )
}
