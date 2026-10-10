import { useEffect, useRef, useState } from 'react'

type LiveOptions = boolean | { onBlur?: boolean; debounce?: number } | null | undefined

/**
 * Local draft for `live({ onBlur, debounce })` fields. Without options every
 * change is written to the bound state immediately; with `onBlur` the draft is
 * written when `commit()` runs (on blur); with `debounce` it is written after
 * the delay (and flushed early by `commit()`).
 */
export function useLiveField<T>(
  value: T | undefined,
  setValue: (value: T) => void,
  live: LiveOptions
): [T | undefined, (value: T) => void, () => void] {
  const onBlur = typeof live === 'object' && live !== null && live.onBlur === true
  const debounce = typeof live === 'object' && live !== null ? live.debounce : undefined
  const [draft, setDraft] = useState(value)
  const [pending, setPending] = useState(false)
  const [previous, setPrevious] = useState(value)
  // The bound value changed outside this input (reset, server state, set()):
  // adopt it as the new draft.
  if (!Object.is(previous, value)) {
    setPrevious(value)
    setDraft(value)
    setPending(false)
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const change = (next: T) => {
    setDraft(next)
    if (onBlur) {
      setPending(true)
      return
    }
    if (debounce !== undefined) {
      setPending(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setPending(false)
        setValue(next)
      }, debounce)
      return
    }
    setValue(next)
  }
  const commit = () => {
    clearTimeout(timer.current)
    if (pending && draft !== undefined) {
      setPending(false)
      setValue(draft)
    }
  }
  return [draft, change, commit]
}
