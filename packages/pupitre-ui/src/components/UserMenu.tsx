import { Menu } from '@base-ui/react/menu'
import { t, useVisit } from '@rikology/pupitre-react'
import type { ShellProps } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import {
  Avatar,
  cn,
  menuItemClasses,
  menuSeparatorClasses,
  popupClasses,
  positionerClasses,
} from '../primitives/index.js'

export type UserMenuProps = {
  panel: ShellProps['panel']
  user: ShellProps['user']
  locale?: string
  locales?: string[]
}

export function UserMenu({ panel, user, locale, locales = [] }: UserMenuProps) {
  const visit = useVisit()
  if (!user) return null
  const userName = user.name ?? ''
  const userEmail = user.email ?? ''
  const hasLinks = Boolean(panel.profileUrl || panel.userMenu?.length)
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-1.5 text-sm outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 data-popup-open:bg-muted"
        aria-label={t('Open user menu')}
      >
        <Avatar name={userName || userEmail} src={user.avatarUrl} className="size-7" />
        <span className="hidden max-w-36 truncate font-medium text-foreground lg:inline">
          {userName}
        </span>
        <Icon name="chevron-down" className="hidden size-3.5 text-muted-foreground lg:block" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={positionerClasses} side="bottom" align="end" sideOffset={6}>
          <Menu.Popup data-pupitre-popup="" className={cn(popupClasses, 'min-w-60')}>
            <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-2">
              <Avatar name={userName || userEmail} src={user.avatarUrl} className="size-9" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </div>
            {hasLinks && <Menu.Separator className={menuSeparatorClasses} />}
            {panel.profileUrl && (
              <Menu.Item className={menuItemClasses} onClick={() => visit(panel.profileUrl!)}>
                <Icon name="user" />
                {t('Profile')}
              </Menu.Item>
            )}
            {panel.userMenu?.map((item) => (
              <Menu.Item
                key={`${item.label}:${item.url}`}
                className={menuItemClasses}
                onClick={() =>
                  item.external
                    ? window.open(item.url, '_blank', 'noopener,noreferrer')
                    : visit(item.url, { method: item.method ?? 'get' })
                }
              >
                {item.icon ? (
                  <Icon name={item.icon} />
                ) : (
                  <span aria-hidden="true" className="size-4" />
                )}
                <span className="flex-1">{item.label}</span>
                {item.external && <Icon name="arrow-up-right" className="!size-3.5" />}
              </Menu.Item>
            ))}
            {locales.length > 1 && (
              <>
                <Menu.Separator className={menuSeparatorClasses} />
                <Menu.Group>
                  <Menu.GroupLabel className="px-2.5 py-1.5 text-xs text-muted-foreground">
                    {t('Language')}
                  </Menu.GroupLabel>
                  <Menu.RadioGroup
                    value={locale}
                    onValueChange={(language) => {
                      if (language !== locale)
                        visit(`${panel.path}/locale`, {
                          method: 'post',
                          data: { locale: language },
                          preserveScroll: true,
                        })
                    }}
                  >
                    {locales.map((language) => (
                      <Menu.RadioItem key={language} value={language} className={menuItemClasses}>
                        <span aria-hidden="true" className="size-4">
                          {language === locale && <Icon name="check" />}
                        </span>
                        <span lang={language}>
                          {new Intl.DisplayNames([language], { type: 'language' }).of(language) ??
                            language}
                        </span>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Group>
              </>
            )}
            {panel.logoutUrl && (
              <>
                <Menu.Separator className={menuSeparatorClasses} />
                <Menu.Item
                  className={menuItemClasses}
                  onClick={() => visit(panel.logoutUrl!, { method: 'post' })}
                >
                  <Icon name="log-out" />
                  {t('Log out')}
                </Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
