import { Menu } from '@base-ui/react/menu'
import { t, useVisit } from '@rikology/pupitre-react'
import type { ShellProps } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'

export type TenantSwitcherProps = { tenant: ShellProps['tenant']; tenants: ShellProps['tenants'] }

/** Sidebar menu for switching between authorized tenants. */
export function TenantSwitcher({ tenant, tenants }: TenantSwitcherProps) {
  const visit = useVisit()
  if (!tenant || tenants.length < 2) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className="mb-3 flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
        aria-label={t('Switch tenant')}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="home" className="size-4 shrink-0" />
          <span className="truncate">{tenant.name}</span>
        </span>
        <Icon name="chevron-down" className="size-3 shrink-0" />
      </Menu.Trigger>
      <Menu.Portal container={typeof document === 'undefined' ? undefined : document.body}>
        <Menu.Positioner
          className="z-[110]"
          style={{ zIndex: 110 }}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <Menu.Popup className="z-50 min-w-56 rounded-md border border-border bg-background p-1 text-foreground shadow-lg outline-none">
            {tenants.map((option) => (
              <Menu.Item
                key={option.id}
                disabled={option.current}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:cursor-default disabled:opacity-60"
                onClick={() =>
                  !option.current &&
                  visit(option.url, {
                    method: option.method ?? 'get',
                    ...(option.method === 'post' ? { data: { tenant: option.id } } : {}),
                  })
                }
              >
                <span>{option.name}</span>
                {option.current && (
                  <span className="text-xs text-muted-foreground">{t('Current')}</span>
                )}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
