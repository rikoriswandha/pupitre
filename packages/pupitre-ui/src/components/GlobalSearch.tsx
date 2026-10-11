import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useEffect, useState } from 'react'
import { Command } from 'cmdk'
import type { GlobalSearchResponse } from '@rikology/pupitre/catalog'
import { globalSearchResponse } from '@rikology/pupitre/catalog'
import { jsonFetch, matchesKeyBinding, t, useVisit } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Button } from '../primitives/index.js'

export type GlobalSearchProps = { search: { url: string; keyBinding: string } | undefined }

/** Search panel resources from the topbar using the panel's configured shortcut. */
export function GlobalSearch({ search }: GlobalSearchProps) {
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
        render={<Button type="button" variant="outline" />}
        aria-label={t('Global search')}
        className="h-9 min-h-9 justify-start gap-2 px-3 text-muted-foreground"
      >
        <Icon name="search" className="size-4" />
        <span className="hidden sm:inline">{t('Search')}</span>
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs sm:inline">
          {search.keyBinding}
        </kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-[15vh] z-50 w-[min(92vw,40rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl outline-none">
          <Dialog.Title className="sr-only">{t('Global search')}</Dialog.Title>
          <Command label={t('Global search')} shouldFilter={false}>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Icon name="search" className="size-4 shrink-0 text-muted-foreground" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t('Search resources...')}
                aria-label={t('Search resources')}
                aria-expanded={groups.length > 0}
                ref={searchInputRef}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                {t('Esc')}
              </kbd>
            </div>
            {groups.length === 0 && (
              <div role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
                {loading
                  ? t('Searching...')
                  : term.length < 2
                    ? t('Type at least 2 characters to search.')
                    : t('No results found.')}
              </div>
            )}
            <Command.List
              hidden={groups.length === 0}
              className="max-h-[min(60vh,28rem)] overflow-y-auto p-2"
            >
              {groups.map((group) => (
                <Command.Group
                  key={group.resource}
                  heading={group.label}
                  className="px-1 py-1 text-xs font-medium text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2"
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
                      className="cursor-pointer rounded-md px-3 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <span className="block truncate font-medium text-foreground">
                        {result.title}
                      </span>
                      {result.details?.length ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {result.details.join(' · ')}
                        </span>
                      ) : null}
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
