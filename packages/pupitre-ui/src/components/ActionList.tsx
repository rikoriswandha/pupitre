import { Menu } from '@base-ui/react/menu'
import { t, useRunAction } from '@rikology/pupitre-react'
import type { ActionDescriptor } from '@rikology/pupitre/catalog'
import { Icon } from '../icons.js'
import {
  type ButtonSize,
  type Tone,
  buttonClasses,
  cn,
  menuDangerItemClasses,
  menuItemClasses,
  menuSeparatorClasses,
  popupClasses,
  positionerClasses,
} from '../primitives/index.js'
import { ActionButton, actionTone } from './ActionButton.js'

export type ActionListProps = {
  actions: ActionDescriptor[]
  ids?: Array<string | number>
  record?: Record<string, unknown>
  /**
   * Inline actions before the rest collapse into a "More actions" menu. Explicit
   * `action.group` values always render as their own dropdown.
   */
  max?: number
  size?: ButtonSize
  /** `buttons` for page/section headers; `links` for compact table rows. */
  appearance?: 'buttons' | 'links'
  /** Give the leading uncolored action the primary tone (page header behaviour). */
  promotePrimary?: boolean
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  className?: string
  onRun?: (action: ActionDescriptor) => void
}

/**
 * Lays out action descriptors: inline buttons, named groups, and an overflow menu.
 * Descriptors the server compiled as `enabled: false` (unauthorized, `visible()` false,
 * unsafe URL) are hidden rather than rendered disabled.
 */
export function ActionList({
  actions,
  ids,
  record,
  max = Number.POSITIVE_INFINITY,
  size = 'md',
  appearance = 'buttons',
  promotePrimary = false,
  align = 'start',
  disabled = false,
  className,
  onRun,
}: ActionListProps) {
  const groups = new Map<string, ActionDescriptor[]>()
  const ungrouped: ActionDescriptor[] = []
  for (const action of actions) {
    if (!action.enabled) continue
    if (!action.group) ungrouped.push(action)
    else groups.set(action.group, [...(groups.get(action.group) ?? []), action])
  }
  // Destructive actions never take an inline slot in row lists when space is tight.
  const ordered =
    appearance === 'links' && ungrouped.length > max
      ? [
          ...ungrouped.filter((action) => actionTone(action) !== 'danger'),
          ...ungrouped.filter((action) => actionTone(action) === 'danger'),
        ]
      : ungrouped
  const inline = ordered.slice(0, max)
  const overflow = ordered.slice(max)
  const primaryName = promotePrimary
    ? (inline.find((action) => action.name === 'create' && !action.color)?.name ??
      inline.find((action) => !action.color && actionTone(action) !== 'danger')?.name)
    : undefined
  if (!inline.length && !groups.size && !overflow.length) return null
  return (
    <div
      data-pupitre-actions=""
      data-appearance={appearance}
      className={cn(
        'flex items-center',
        appearance === 'links' ? 'flex-nowrap gap-1' : 'flex-wrap gap-2',
        align === 'end' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start',
        className
      )}
    >
      {inline.map((action) => (
        <ActionButton
          key={action.name}
          action={action}
          ids={ids}
          record={record}
          size={appearance === 'links' ? 'xs' : size}
          variant={
            appearance === 'links'
              ? action.variant === 'link'
                ? 'link'
                : 'ghost'
              : actionTone(action) === 'danger' && !action.color
                ? 'outline'
                : undefined
          }
          fallbackTone={
            action.name === primaryName ? 'primary' : appearance === 'links' ? 'primary' : 'gray'
          }
          // Row actions: 13px instead of xs 12px so they read as controls, not footnotes.
          className={appearance === 'links' ? 'px-2 text-[0.8125rem]' : undefined}
          disabled={disabled}
          onRun={onRun}
        />
      ))}
      {[...groups].map(([label, grouped]) => (
        <ActionMenu
          key={label}
          label={label}
          actions={grouped}
          ids={ids}
          record={record}
          size={appearance === 'links' ? 'xs' : size}
          disabled={disabled}
          onRun={onRun}
        />
      ))}
      {overflow.length > 0 && (
        <ActionMenu
          actions={overflow}
          ids={ids}
          record={record}
          size={appearance === 'links' ? 'xs' : size}
          disabled={disabled}
          onRun={onRun}
        />
      )}
    </div>
  )
}

export type ActionMenuProps = {
  actions: ActionDescriptor[]
  /** Visible trigger label; omitted renders an icon-only "More actions" trigger. */
  label?: string
  icon?: string
  ids?: Array<string | number>
  record?: Record<string, unknown>
  size?: ButtonSize
  tone?: Tone
  disabled?: boolean
  onRun?: (action: ActionDescriptor) => void
}

/** Dropdown of action descriptors; destructive actions sit last behind a separator. */
export function ActionMenu({
  actions: descriptors,
  label,
  icon,
  ids,
  record,
  size = 'md',
  tone = 'gray',
  disabled = false,
  onRun,
}: ActionMenuProps) {
  const runAction = useRunAction()
  const actions = descriptors.filter((action) => action.enabled)
  const safe = actions.filter((action) => actionTone(action) !== 'danger')
  const danger = actions.filter((action) => actionTone(action) === 'danger')
  const item = (action: ActionDescriptor) => (
    <Menu.Item
      key={action.name}
      disabled={disabled}
      className={cn(
        menuItemClasses,
        actionTone(action) === 'danger' ? menuDangerItemClasses : undefined
      )}
      data-action={action.name}
      onClick={async () => {
        await runAction(action, { ids, record })
        onRun?.(action)
      }}
    >
      {action.icon ? <Icon name={action.icon} /> : null}
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
    </Menu.Item>
  )
  if (!actions.length) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={label ? undefined : t('More actions')}
        disabled={disabled}
        className={buttonClasses({
          variant: label ? 'solid' : 'ghost',
          color: tone,
          size,
          square: !label,
        })}
      >
        {label ? (
          <>
            {icon && <Icon name={icon} />}
            {label}
            <Icon name="chevron-down" className="-mr-0.5 opacity-60" />
          </>
        ) : (
          <Icon name="more-horizontal" />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={positionerClasses} side="bottom" align="end" sideOffset={6}>
          <Menu.Popup data-pupitre-popup="" className={popupClasses}>
            {safe.map(item)}
            {safe.length > 0 && danger.length > 0 && (
              <Menu.Separator className={menuSeparatorClasses} />
            )}
            {danger.map(item)}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
