import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useEffect, useState } from 'react'
import { Command } from 'cmdk'
import type { GlobalSearchResponse } from '@rikology/pupitre/catalog'
import { globalSearchResponse } from '@rikology/pupitre/catalog'
import { jsonFetch, matchesKeyBinding, t, useVisit } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Kbd, Spinner, backdropClasses, cn } from '../primitives/index.js'

export type GlobalSearchProps = {
  search: { url: string; keyBinding: string } | undefined
  /** Icon-sized trigger for crowded bars (top navigation). */
  compact?: boolean
}

/** Renders `mod+k` as platform keycaps (⌘ K on Apple, Ctrl K elsewhere). */
function keyCaps(binding: string): string[] {
  const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return binding.split('+').map((part) => {
    const key = part.trim().toLowerCase()
    if (key === 'mod') return apple ? '⌘' : 'Ctrl'
    if (key === 'shift') return apple ? '⇧' : 'Shift'
    if (key === 'alt') return apple ? '⌥' : 'Alt'
    if (key === 'ctrl') return 'Ctrl'
    return key.length === 1 ? key.toUpperCase() : key
  })
}

/** Search panel resources from the topbar using the panel's configured shortcut. */
export function GlobalSearch({ search, compact = false }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{
    term: string
    groups: GlobalSearchResponse['groups']
  }>({ term: '', groups: [] })
  const [loadingTerm, setLoadingTerm] = useState<string | null>(null)
  const visit = useVisit()
  const term = query.trim()
  const groups = results.term === term ? results.groups : []
  const searchInputRef = useCallback(
    (input: HTMLInputElement | null) => {
      if (!input) return
      input.removeAttribute('aria-labelledby')
      input.setAttribute('aria-label', t('Search resources'))
      input.setAttribute('aria-expanded', String(groups.length > 0))
    },
    [groups.length]
  )

  useEffect(() => {
    if (!search) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesKeyBinding(event, search.keyBinding)) return
      event.preventDefault()
      setOpen((value) => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [search])

  useEffect(() => {
    if (!search || term.length < 2) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setLoadingTerm(term)
      void jsonFetch(`${search.url}?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Global search request failed')
          return globalSearchResponse.parse(await response.json())
        })
        .then((result) => {
          if (!controller.signal.aborted) setResults({ term, groups: result.groups })
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            (error instanceof DOMException && error.name === 'AbortError')
          ) {
            return
          }
          setResults({ term, groups: [] })
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingTerm(null)
        })
    }, 250)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [term, search])
  const loading = term.length >= 2 && (loadingTerm === term || results.term !== term)

  if (!search) return null

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t('Global search')}
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg text-sm text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/30',
          compact
            ? 'w-9 justify-center hover:bg-muted hover:text-foreground'
            : 'w-9 justify-center hover:bg-muted hover:text-foreground sm:w-64 sm:justify-start sm:border sm:border-input sm:bg-card sm:px-2.5 sm:shadow-control sm:hover:bg-card sm:hover:text-foreground'
        )}
      >
        <Icon name="search" className="size-4 shrink-0" />
        {!compact && (
          <>
            <span className="hidden flex-1 text-left sm:inline">{t('Search')}</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              {keyCaps(search.keyBinding).map((cap) => (
                <Kbd key={cap}>{cap}</Kbd>
              ))}
            </span>
          </>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={backdropClasses} />
        <Dialog.Popup
          data-pupitre-popup=""
          className="fixed left-1/2 top-[12vh] z-[101] w-[min(calc(100vw-2rem),40rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-dialog outline-none transition-[opacity,scale] duration-150 ease-ui data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
        >
          <Dialog.Title className="sr-only">{t('Global search')}</Dialog.Title>
          <Command label={t('Global search')} shouldFilter={false}>
            <div className="flex items-center gap-3 border-b border-border px-4">
              {loading ? (
                <Spinner className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Icon name="search" className="size-4 shrink-0 text-muted-foreground" />
              )}
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t('Search resources...')}
                aria-label={t('Search resources')}
                aria-expanded={groups.length > 0}
                ref={searchInputRef}
                className="h-13 w-full bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-subtle-foreground"
              />
              <Kbd>{t('Esc')}</Kbd>
            </div>
            {groups.length === 0 && (
              <div
                role="status"
                className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground"
              >
                <Icon
                  name={term.length >= 2 && !loading ? 'inbox' : 'search'}
                  className="size-5 text-subtle-foreground"
                />
                {loading
                  ? t('Searching...')
                  : term.length < 2
                    ? t('Type at least 2 characters to search.')
                    : t('No results found.')}
              </div>
            )}
            <Command.List
              hidden={groups.length === 0}
              className="pupitre-scroll max-h-[min(60vh,28rem)] overflow-y-auto p-2"
            >
              {groups.map((group) => (
                <Command.Group
                  key={group.resource}
                  heading={group.label}
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {group.results.map((result) => (
                    <Command.Item
                      key={`${group.resource}:${result.url}`}
                      value={`${group.resource}:${result.title}:${result.url}`}
                      onSelect={() => {
                        setOpen(false)
                        setQuery('')
                        visit(result.url)
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent"
                    >
                      <Icon name="file-text" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {result.title}
                        </span>
                        {result.details?.length ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {result.details.join(' · ')}
                          </span>
                        ) : null}
                      </span>
                      <Icon
                        name="corner-down-left"
                        className="size-3.5 shrink-0 text-subtle-foreground opacity-0 [[aria-selected=true]_&]:opacity-100"
                      />
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
