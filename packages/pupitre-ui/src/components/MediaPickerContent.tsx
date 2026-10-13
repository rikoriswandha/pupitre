import { useEffect, useId, useState } from 'react'
import { jsonFetch, t, useBoundValue, useFieldError, usePanel } from '@rikology/pupitre-react'
import { Button, Input } from '../primitives/index.js'
import { batchedMediaRows, mediaRows, type MediaItem } from './media_protocol.js'
export type MediaPickerProps = {
  props: {
    value?: unknown
    name: string
    label?: string | null
    multiple?: boolean
    maxItems?: number
    accept?: string[]
    conversion?: string
    disabled?: boolean
    readOnly?: boolean
    error?: unknown
    helperText?: string | null
    required?: boolean
  }
  bindings?: Record<string, string | undefined>
  emit: (event: string, value?: unknown) => void
}
export default function MediaPickerContent({ props, bindings, emit }: MediaPickerProps) {
  const { panel } = usePanel()
  const endpoint = `${panel.path}/_pupitre/media`
  const [value, setValue] = useBoundValue(props.value, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const id = useId()
  const ids = (Array.isArray(value) ? value : [value]).filter(
    (idValue): idValue is number =>
      typeof idValue === 'number' && Number.isSafeInteger(idValue) && idValue > 0
  )
  const signature = ids.join(',')
  const [selected, setSelected] = useState<MediaItem[]>([])
  const [rows, setRows] = useState<MediaItem[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const disabled = props.disabled || props.readOnly || busy
  useEffect(() => {
    if (!signature) return
    let cancelled = false
    void batchedMediaRows(panel.path, props.conversion ?? 'thumb', signature.split(',').map(Number))
      .then((items) => {
        if (!cancelled) setSelected(items)
      })
      .catch(() => {
        if (!cancelled) setFailure(t('Media request failed'))
      })
    return () => {
      cancelled = true
    }
  }, [panel.path, signature, props.conversion])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(() => {
      void mediaRows(
        `${endpoint}?${new URLSearchParams({ q: search, conversion: props.conversion ?? 'thumb' })}`
      )
        .then((items) => {
          if (!cancelled) setRows(items)
        })
        .catch(() => {
          if (!cancelled) setFailure(t('Media request failed'))
        })
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [endpoint, search, open, props.conversion])
  function change(next: number[]) {
    const result = props.multiple ? next : (next[0] ?? null)
    setValue(result)
    emit('change', result)
  }
  function select(item: MediaItem) {
    if (disabled || ids.includes(item.id)) return
    if (props.multiple && ids.length >= (props.maxItems ?? 5)) return
    change(props.multiple ? [...ids, item.id] : [item.id])
    if (!props.multiple) setOpen(false)
  }
  async function upload(files: FileList | null) {
    if (!files?.length || disabled) return
    setBusy(true)
    setFailure(undefined)
    try {
      const paths = []
      const filenames = []
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.set('file', file)
        body.set('resource', 'media')
        body.set('field', 'path')
        const response = await jsonFetch(`${panel.path}/_pupitre/upload`, { method: 'POST', body })
        if (!response.ok) throw new Error(t('Media request failed'))
        const result: unknown = await response.json()
        if (
          !result ||
          typeof result !== 'object' ||
          !('key' in result) ||
          typeof result.key !== 'string'
        )
          throw new Error(t('Media request failed'))
        paths.push(result.key)
        filenames.push(file.name)
      }
      const response = await jsonFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ paths, filenames }),
      })
      if (!response.ok) throw new Error(t('Media request failed'))
      const uploaded = await mediaRows(response)
      setRows((current) => [...uploaded, ...current])
      change(
        props.multiple
          ? [...ids, ...uploaded.map((item) => item.id)].slice(0, props.maxItems ?? 5)
          : [uploaded[0]!.id]
      )
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : t('Media request failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <fieldset disabled={Boolean(disabled)} className="space-y-3">
      <legend className="text-sm font-medium">
        {props.label ?? props.name}
        {props.required ? ' *' : ''}
      </legend>
      <ol className="space-y-2">
        {ids.map((key, index) => {
          const item = selected.find((row) => row.id === key)
          return (
            <li key={key} className="flex items-center gap-2">
              {item && (
                <img src={item.url} alt={item.alt} className="size-16 rounded object-cover" />
              )}
              <span className="min-w-0 flex-1 truncate">{item?.filename ?? key}</span>
              {props.multiple && (
                <>
                  <Button
                    type="button"
                    disabled={index === 0}
                    aria-label={t('Move {name} up', { name: item?.filename ?? String(key) })}
                    onClick={() => {
                      const next = [...ids]
                      ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
                      change(next)
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    disabled={index === ids.length - 1}
                    aria-label={t('Move {name} down', { name: item?.filename ?? String(key) })}
                    onClick={() => {
                      const next = [...ids]
                      ;[next[index + 1], next[index]] = [next[index]!, next[index + 1]!]
                      change(next)
                    }}
                  >
                    ↓
                  </Button>
                </>
              )}
              <Button
                type="button"
                aria-label={t('Remove {name}', { name: item?.filename ?? String(key) })}
                onClick={() => change(ids.filter((itemId) => itemId !== key))}
              >
                ×
              </Button>
            </li>
          )
        })}
      </ol>
      <Button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-browser`}
        onClick={() => setOpen(!open)}
      >
        {t('Choose media')}
      </Button>
      {open && (
        <section
          id={`${id}-browser`}
          aria-label={t('Media library')}
          className="space-y-3 rounded border p-3"
        >
          <label htmlFor={`${id}-search`}>{t('Search media')}</label>
          <Input
            id={`${id}-search`}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <label className="block" htmlFor={`${id}-upload`}>
            {t('Upload media')}
          </label>
          <input
            id={`${id}-upload`}
            type="file"
            accept={(props.accept ?? ['image/*']).join(',')}
            multiple={props.multiple}
            onChange={(event) => {
              void upload(event.currentTarget.files)
              event.currentTarget.value = ''
            }}
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {rows
              .filter((item) =>
                (props.accept ?? ['image/*']).some((mime) =>
                  mime.endsWith('/*') ? item.mime.startsWith(mime.slice(0, -1)) : mime === item.mime
                )
              )
              .map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  className="h-auto flex-col p-2"
                  aria-pressed={ids.includes(item.id)}
                  disabled={
                    ids.includes(item.id) ||
                    Boolean(props.multiple && ids.length >= (props.maxItems ?? 5))
                  }
                  onClick={() => select(item)}
                >
                  <img src={item.url} alt="" className="h-24 w-full object-cover" />
                  <span>{item.filename}</span>
                </Button>
              ))}
          </div>
        </section>
      )}
      {props.helperText && <p className="text-sm text-muted-foreground">{props.helperText}</p>}
      {(error || failure) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? failure}
        </p>
      )}
      {busy && <p role="status">{t('Loading media')}</p>}
    </fieldset>
  )
}
