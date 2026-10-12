import { Menu } from '@base-ui/react/menu'
import { t, useVisit } from '@rikology/pupitre-react'
import type { ShellProps } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import {
  cn,
  menuItemClasses,
  menuLabelClasses,
  popupClasses,
  positionerClasses,
} from '../primitives/index.js'

export type TenantSwitcherProps = {
  tenant: ShellProps['tenant']
  tenants: ShellProps['tenants']
  /** Inline trigger for the top-navigation bar instead of the full-width sidebar card. */
  compact?: boolean
}

function TenantMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[0.6875rem] font-semibold text-foreground ring-1 ring-inset ring-border"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Menu for switching between the tenants the current user can access. */
export function TenantSwitcher({ tenant, tenants, compact = false }: TenantSwitcherProps) {
  const visit = useVisit()
  if (!tenant || tenants.length < 2) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className={cn(
          'flex items-center gap-2.5 rounded-lg text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/30 data-popup-open:bg-sidebar-accent',
          compact
            ? 'h-9 px-2 hover:bg-muted'
            : 'w-full border border-sidebar-border bg-card px-2 py-1.5 shadow-control hover:bg-sidebar-accent'
        )}
        aria-label={t('Switch tenant')}
      >
        <TenantMark name={tenant.name} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{tenant.name}</span>
        <Icon name="chevrons-up-down" className="size-4 shrink-0 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={positionerClasses} side="bottom" align="start" sideOffset={6}>
          <Menu.Popup data-pupitre-popup="" className={cn(popupClasses, 'min-w-60')}>
            <Menu.Group>
              <Menu.GroupLabel className={menuLabelClasses}>{t('Switch tenant')}</Menu.GroupLabel>
              {tenants.map((option) => (
                <Menu.Item
                  key={option.id}
                  disabled={option.current}
                  className={cn(
                    menuItemClasses,
                    'data-disabled:cursor-default data-disabled:opacity-100'
                  )}
                  onClick={() =>
                    !option.current &&
                    visit(option.url, {
                      method: option.method ?? 'get',
                      ...(option.method === 'post' ? { data: { tenant: option.id } } : {}),
                    })
                  }
                >
                  <TenantMark name={option.name} />
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  {option.current && (
                    <>
                      <Icon name="check" className="!text-primary-ink" />
                      <span className="sr-only">{t('Current')}</span>
                    </>
                  )}
                </Menu.Item>
              ))}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
