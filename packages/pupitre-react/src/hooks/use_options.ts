import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchOptions } from '../bridge/actions.js'
import type { Option } from '../bridge/actions.js'

export function useOptions(args: {
  url?: string
  value: unknown
  initial?: Option[]
  preload?: boolean
  debounce?: number
}) {
  const { url, value, initial = [], preload = false, debounce = 250 } = args
  const selectedKey = JSON.stringify(value)
  const selected = useMemo(
    () =>
      Array.isArray(value)
        ? value
        : value === null || value === undefined || value === ''
          ? []
          : [value],
    // Unbound multi-select values can be fresh equivalent arrays on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedKey]
  )
  const [options, setOptions] = useState<Option[]>(initial)
  const [createdOptions, setCreatedOptions] = useState<Option[]>([])
  const [search, setSearchValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const load = useCallback(
    async (
      query: string,
      nextPage: number,
      append: boolean,
      selectedValues: Array<string | number>
    ) => {
      if (!url) return
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      setLoading(true)
      setError(null)
      try {
        const result = await fetchOptions(url, {
          search: query,
          selected: selectedValues,
          page: nextPage,
          signal: controller.signal,
        })
        if (controller.signal.aborted || request.current !== controller) return
        setOptions((previous) => {
          const merged = append ? [...previous] : []
          for (const option of result.options) {
            const index = merged.findIndex((item) => String(item.value) === String(option.value))
            if (index === -1) merged.push(option)
            else merged[index] = option
          }
          return merged
        })
        setHasMore(result.hasMore)
        setPage(nextPage)
      } catch (failure) {
        if (
          !controller.signal.aborted &&
          request.current === controller &&
          !(failure instanceof DOMException && failure.name === 'AbortError')
        )
          setError(failure instanceof Error ? failure.message : 'Unable to load options')
      } finally {
        if (request.current === controller) setLoading(false)
      }
    },
    [url]
  )
  useEffect(() => {
    if (!url || preload) return
    const selectedValues = selected.filter(
      (item): item is string | number => typeof item === 'string' || typeof item === 'number'
    )
    const timer = setTimeout(
      () => void load(search, 1, false, selectedValues),
      search ? debounce : 0
    )
    return () => {
      clearTimeout(timer)
      request.current?.abort()
    }
  }, [url, search, debounce, load, selected, preload])

  useEffect(() => () => request.current?.abort(), [])
  const preloadedOptions = useMemo(() => {
    const merged = [...initial]
    for (const option of createdOptions) {
      const index = merged.findIndex((item) => String(item.value) === String(option.value))
      if (index === -1) merged.push(option)
      else merged[index] = option
    }
    const query = search.trim().toLowerCase()
    if (!query) return merged
    const selectedValues = new Set(selected.map((item) => String(item)))
    return merged.filter(
      (option) =>
        selectedValues.has(String(option.value)) ||
        option.label.toLowerCase().includes(query) ||
        String(option.value).toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query)
    )
  }, [initial, createdOptions, search, selected])

  const addOption = useCallback((option: Option) => {
    setCreatedOptions((previous) => {
      const next = [...previous]
      const index = next.findIndex((item) => String(item.value) === String(option.value))
      if (index === -1) next.push(option)
      else next[index] = option
      return next
    })
  }, [])

  const loadMore = useCallback(() => {
    if (!url || preload || loading || !hasMore) return
    void load(
      search,
      page + 1,
      true,
      selected.filter(
        (item): item is string | number => typeof item === 'string' || typeof item === 'number'
      )
    )
  }, [url, preload, loading, hasMore, load, search, page, selected])

  return {
    options: preload ? preloadedOptions : options,
    search,
    setSearch: setSearchValue,
    loading,
    hasMore: preload ? false : hasMore,
    loadMore,
    addOption,
    error,
  }
}
