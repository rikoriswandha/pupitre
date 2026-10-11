import { useRunAction } from '@rikology/pupitre-react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { Icon } from '../icons.js'
import { Button } from '../primitives/index.js'

export function ActionButton({
  action,
  ids,
  record,
}: {
  action: ActionDescriptor
  ids?: Array<string | number>
  record?: Record<string, unknown>
}) {
  const runAction = useRunAction()
  const variant = action.variant ?? 'button'
  return (
    <Button
      type="button"
      aria-label={variant === 'iconButton' ? action.label : undefined}
      title={variant === 'iconButton' ? action.label : undefined}
      disabled={!action.enabled}
      variant={
        variant === 'link'
          ? 'ghost'
          : action.color === 'danger'
            ? 'destructive'
            : action.color === 'gray'
              ? 'outline'
              : 'default'
      }
      className={variant === 'link' ? 'text-primary underline-offset-4 hover:underline' : undefined}
      onClick={() => void runAction(action, { ids, record })}
    >
      {action.icon && <Icon name={action.icon} className="size-4" />}
      {variant === 'iconButton' ? <span className="sr-only">{action.label}</span> : action.label}
    </Button>
  )
}
