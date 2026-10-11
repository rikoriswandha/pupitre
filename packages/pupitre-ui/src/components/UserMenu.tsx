import { t } from '@rikology/pupitre-react'
import { Menu } from '@base-ui/react/menu'
import { useVisit } from '@rikology/pupitre-react'
import type { ShellProps } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'

export type UserMenuProps = { panel: ShellProps['panel']; user: ShellProps['user'] }

export function UserMenu({ panel, user }: UserMenuProps) {
  const visit = useVisit()
  const userName = user?.name ?? ''
  const userEmail = user?.email ?? ''
  const userAvatar = user?.avatarUrl
  if (!user) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        aria-label={t('Open user menu')}
      >
        {userAvatar ? (
          <img src={userAvatar} alt="" className="size-6 rounded-full object-cover" />
        ) : (
          <Icon name="user" className="size-4" />
        )}
        <span className="max-w-40 truncate">{userName}</span>
        <Icon name="chevron-down" className="size-3" />
      </Menu.Trigger>
      <Menu.Portal container={typeof document === 'undefined' ? undefined : document.body}>
        <Menu.Positioner
          className="z-[110]"
          style={{ zIndex: 110 }}
          side="bottom"
          align="end"
          sideOffset={6}
        >
          <Menu.Popup className="z-50 min-w-56 rounded-md border border-border bg-background p-1 text-foreground shadow-lg outline-none">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </div>
            {panel.profileUrl && (
              <Menu.Item
                className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus:bg-muted"
                onClick={() => visit(panel.profileUrl!)}
              >
                <Icon name="user" className="size-4" />
                {t('Profile')}
              </Menu.Item>
            )}
            {panel.userMenu?.map((item) => (
              <Menu.Item
                key={`${item.label}:${item.url}`}
                className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus:bg-muted"
                onClick={() =>
                  item.external
                    ? window.open(item.url, '_blank', 'noopener,noreferrer')
                    : visit(item.url, { method: item.method ?? 'get' })
                }
              >
                {item.icon && <Icon name={item.icon} className="size-4" />}
                {item.label}
              </Menu.Item>
            ))}
            {panel.logoutUrl && (
              <Menu.Item
                className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-muted focus:bg-muted"
                onClick={() => visit(panel.logoutUrl!, { method: 'post' })}
              >
                <Icon name="log-out" className="size-4" />
                {t('Log out')}
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
