import { useEffect } from 'react'
import { useRunAction } from '@rikology/pupitre-react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { Icon } from '../icons.js'
import { Button } from '../primitives/index.js'
import { matchesKeyBinding } from '../primitives/key_bindings.js'

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
  useEffect(() => {
    const bindings = action.keyBindings ?? []
    if (bindings.length === 0 || !action.enabled) return
    const handler = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return
      if (!bindings.some((binding) => matchesKeyBinding(event, binding))) return
      event.preventDefault()
      void runAction(action, { ids, record })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [action, ids, record, runAction])
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
