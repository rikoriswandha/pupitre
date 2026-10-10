import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { useRunAction } from '@rikology/pupitre-react'
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
