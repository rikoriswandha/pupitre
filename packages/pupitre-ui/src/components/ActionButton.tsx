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
  return (
    <Button
      type="button"
      disabled={!action.enabled}
      variant={
        action.color === 'danger' ? 'destructive' : action.color === 'gray' ? 'outline' : 'default'
      }
      onClick={() => void runAction(action, { ids, record })}
    >
      {action.icon && <Icon name={action.icon} className="size-4" />}
      {action.label}
    </Button>
  )
}
