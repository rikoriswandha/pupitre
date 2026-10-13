import { Children, useContext, type ReactNode } from 'react'
import { t } from '@rikology/pupitre-react'
import { RepeaterContext } from './Repeater.js'
import { Button } from '../primitives/index.js'
import { Icon } from '../icons.js'

export function RepeaterTableRow({
  index,
  children,
  loading = false,
}: {
  index: number
  children?: ReactNode
  loading?: boolean
}) {
  const context = useContext(RepeaterContext)
  const disabled = loading || context.disabled
  const label = t('Item {number}', { number: index + 1 })
  return (
    <tr
      className="border-t border-border"
      onDragOver={(event) => {
        if (
          !disabled &&
          context.reorderable &&
          event.dataTransfer.types.includes('application/x-pupitre-repeater')
        ) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      }}
      onDrop={(event) => {
        if (disabled || !context.reorderable) return
        const source = event.dataTransfer.getData('application/x-pupitre-repeater')
        if (!source) return
        event.preventDefault()
        try {
          const value: unknown = JSON.parse(source)
          if (Array.isArray(value) && value[0] === context.dragId && Number.isInteger(value[1]))
            context.moveTo(value[1] as number, index)
        } catch {
          // Ignore drag payloads that were not produced by this repeater.
        }
      }}
    >
      {Children.map(children, (child, position) => (
        <td
          className="py-3 pr-6 align-top [&_[data-input-label]]:sr-only"
          style={{
            width: context.table?.[position]?.width,
            minWidth: context.table?.[position]?.width ?? '10rem',
            textAlign: context.table?.[position]?.alignment ?? 'start',
          }}
        >
          {child}
        </td>
      ))}
      <td className="w-px whitespace-nowrap py-3 align-top">
        <div className="flex justify-end gap-1">
          {context.reorderable && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                square
                disabled={disabled}
                draggable={!disabled}
                aria-label={t('Drag {label} to reorder', { label })}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData(
                    'application/x-pupitre-repeater',
                    JSON.stringify([context.dragId, index])
                  )
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                  event.preventDefault()
                  context.move(index, event.key === 'ArrowUp' ? 'up' : 'down')
                }}
              >
                <Icon name="grip-vertical" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                square
                aria-label={t('Move {label} up', { label })}
                disabled={disabled || index === 0}
                onClick={() => context.move(index, 'up')}
              >
                <Icon name="arrow-up" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                square
                aria-label={t('Move {label} down', { label })}
                disabled={disabled || index >= context.itemCount - 1}
                onClick={() => context.move(index, 'down')}
              >
                <Icon name="arrow-down" />
              </Button>
            </>
          )}
          {context.cloneable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              square
              aria-label={t('Clone {label}', { label })}
              disabled={disabled || context.itemCount >= context.maxItems}
              onClick={() => context.clone(index)}
            >
              <Icon name="copy" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            square
            color="danger"
            aria-label={t('Remove {label}', { label })}
            disabled={disabled || context.itemCount <= context.minItems}
            onClick={() => context.remove(index)}
          >
            <Icon name="trash-2" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
