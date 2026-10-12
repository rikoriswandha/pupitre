import { useRunAction } from '@rikology/pupitre-react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { Icon } from '../icons.js'
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
  type Tone,
  Tooltip,
  toTone,
} from '../primitives/index.js'

/**
 * Resolves the visual tone of an action: an explicit server color wins, destructive
 * confirmations and delete builtins read as danger, everything else uses `fallback`.
 */
export function actionTone(action: ActionDescriptor, fallback: Tone = 'gray'): Tone {
  if (action.color) return toTone(action.color, fallback)
  if (action.confirm?.destructive || /(^|[-_])(force-?)?delete$|^forceDelete$/i.test(action.name))
    return 'danger'
  return fallback
}

export type ActionButtonProps = {
  action: ActionDescriptor
  ids?: Array<string | number>
  record?: Record<string, unknown>
  size?: ButtonSize
  /** Overrides the descriptor's `variant` mapping (`link` → link, otherwise solid). */
  variant?: ButtonVariant
  /** Tone used when the descriptor has no color and is not destructive. */
  fallbackTone?: Tone
  disabled?: boolean
  className?: string
  onRun?: (action: ActionDescriptor) => void
}

export function ActionButton({
  action,
  ids,
  record,
  size = 'md',
  variant,
  fallbackTone = 'gray',
  disabled = false,
  className,
  onRun,
}: ActionButtonProps) {
  const runAction = useRunAction()
  const iconOnly = action.variant === 'iconButton'
  const resolvedVariant: ButtonVariant =
    variant ?? (action.variant === 'link' ? 'link' : iconOnly ? 'ghost' : 'solid')
  const tone = actionTone(action, fallbackTone)
  const button = (
    <Button
      type="button"
      aria-label={iconOnly ? action.label : undefined}
      disabled={!action.enabled || disabled}
      variant={resolvedVariant}
      color={tone}
      size={size}
      square={iconOnly}
      className={className}
      data-action={action.name}
      onClick={async () => {
        await runAction(action, { ids, record })
        onRun?.(action)
      }}
    >
      {action.icon ? (
        <Icon name={action.icon} />
      ) : iconOnly ? (
        <Icon name="more-horizontal" />
      ) : null}
      {iconOnly ? null : action.label}
    </Button>
  )
  return iconOnly ? <Tooltip label={action.label}>{button}</Tooltip> : button
}
