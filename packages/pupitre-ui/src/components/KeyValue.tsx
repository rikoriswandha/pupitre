import { useId, useRef, useState, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Button, Field, FieldError, Input, FieldDescription } from '../primitives/index.js'
import { useLiveField } from './use_live_field.js'

import { Icon } from '../icons.js'
import { InputFieldLabel } from './Text.js'

type Props = Infer<typeof components.KeyValue.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}
type Entry = { id: string; key: string; value: string }

export function KeyValue({ props, bindings }: Runtime) {
  const initial = props.value ?? {}
  const [boundValue, setValue] = useBoundValue(initial, bindings?.value)
  const [, changeValue, commitValue] = useLiveField(boundValue, setValue, props.live)
  const initialRows =
    initial && typeof initial === 'object' && !Array.isArray(initial)
      ? Object.entries(initial).map(([key, item], index) => ({
          id: `row-${index}`,
          key,
          value: String(item ?? ''),
        }))
      : []
  const [entries, setEntries] = useState<Entry[]>(initialRows)
  const nextId = useRef(initialRows.length)
  const [newEntry, setNewEntry] = useState<Entry>({ id: 'new', key: '', value: '' })
  const error = useFieldError(props.error, bindings?.value)
  function update(index: number, field: keyof Entry, next: string) {
    const nextEntries = entries.map((entry, i) => ({
      ...entry,
      key: i === index && field === 'key' ? next : entry.key,
      value: i === index && field === 'value' ? next : entry.value,
    }))
    setEntries(nextEntries)
    const keys = nextEntries.map((entry) => entry.key.trim())
    if (keys.some((key) => !key) || new Set(keys).size !== keys.length) return
    changeValue(Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item])))
  }
  function addEntry() {
    if (!newEntry.key.trim() || entries.some((entry) => entry.key === newEntry.key)) return
    const nextEntries = [...entries, { ...newEntry, id: `row-${nextId.current++}` }]
    const keys = nextEntries.map((entry) => entry.key.trim())
    if (keys.some((key) => !key) || new Set(keys).size !== keys.length) return
    setEntries(nextEntries)
    changeValue(Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item])))
    setNewEntry({ id: 'new', key: '', value: '' })
  }
  function moveEntry(index: number, direction: -1 | 1) {
    const nextEntries = [...entries]
    const destination = index + direction
    if (destination < 0 || destination >= nextEntries.length) return
    ;[nextEntries[index], nextEntries[destination]] = [nextEntries[destination], nextEntries[index]]
    const keys = nextEntries.map((entry) => entry.key.trim())
    if (keys.some((key) => !key) || new Set(keys).size !== keys.length) return
    setEntries(nextEntries)
    changeValue(Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item])))
  }
  const generatedId = useId()
  const id = bindings?.value
    ? bindings.value.split('/').slice(2).join('.')
    : (props.name ?? generatedId)
  const describedBy =
    [props.hint && `${id}-hint`, props.helperText && `${id}-helper`, error && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  const columnStyle =
    props.columnSpan === null || props.columnSpan === undefined
      ? undefined
      : {
          gridColumn:
            props.columnSpan === 'full'
              ? '1 / -1'
              : `span ${props.columnSpan} / span ${props.columnSpan}`,
        }
  return (
    <div style={columnStyle}>
      <Field invalid={!!error}>
        <InputFieldLabel id={id} props={props} />
        <div className="overflow-hidden rounded-lg border border-input bg-card">
          <div className="grid grid-cols-[1fr_1fr_6rem] gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{props.keyLabel ?? 'Key'}</span>
            <span>{props.valueLabel ?? 'Value'}</span>
            <span className="sr-only">Actions</span>
          </div>
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0"
            >
              <Input
                bare
                {...props.extraAttributes}
                aria-label={props.keyLabel ?? 'Key'}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                value={entry.key}
                disabled={props.disabled || props.readOnly}
                placeholder={props.keyPlaceholder}
                onChange={(event) => update(index, 'key', event.currentTarget.value)}
                onBlur={() => commitValue()}
                className="h-(--control-h) min-w-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <Input
                bare
                {...props.extraAttributes}
                aria-label={props.valueLabel ?? 'Value'}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                value={entry.value}
                disabled={props.disabled || props.readOnly}
                placeholder={props.valuePlaceholder}
                onChange={(event) => update(index, 'value', event.currentTarget.value)}
                onBlur={() => commitValue()}
                className="h-(--control-h) min-w-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <div className="flex items-center justify-end gap-0.5">
                {props.reorderable && (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      square
                      aria-label={`Move ${entry.key} up`}
                      disabled={props.disabled || props.readOnly || index === 0}
                      onClick={() => moveEntry(index, -1)}
                    >
                      <Icon name="arrow-up" className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      square
                      aria-label={`Move ${entry.key} down`}
                      disabled={props.disabled || props.readOnly || index === entries.length - 1}
                      onClick={() => moveEntry(index, 1)}
                    >
                      <Icon name="arrow-down" className="size-4" />
                    </Button>
                  </div>
                )}
                {props.deletable !== false && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    square
                    disabled={props.disabled || props.readOnly}
                    aria-label={`Remove ${entry.key}`}
                    onClick={() => {
                      const nextEntries = entries.filter((_, i) => i !== index)
                      const keys = nextEntries.map((row) => row.key.trim())
                      if (keys.some((key) => !key) || new Set(keys).size !== keys.length) return
                      setEntries(nextEntries)
                      changeValue(
                        Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item]))
                      )
                    }}
                  >
                    <Icon name="trash-2" className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {props.addable !== false && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0">
              <Input
                bare
                {...props.extraAttributes}
                aria-label={props.keyLabel ?? 'Key'}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                value={newEntry.key}
                onChange={(event) => setNewEntry({ ...newEntry, key: event.currentTarget.value })}
                placeholder={props.keyPlaceholder}
                disabled={props.disabled || props.readOnly}
                className="h-(--control-h) min-w-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <Input
                bare
                {...props.extraAttributes}
                aria-label={props.valueLabel ?? 'Value'}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                value={newEntry.value}
                onChange={(event) => setNewEntry({ ...newEntry, value: event.currentTarget.value })}
                placeholder={props.valuePlaceholder}
                disabled={props.disabled || props.readOnly}
                className="h-(--control-h) min-w-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={props.disabled || props.readOnly || !newEntry.key.trim()}
                onClick={addEntry}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        {props.helperText && (
          <FieldDescription id={`${id}-helper`}>{props.helperText}</FieldDescription>
        )}
        {error && (
          <div id={`${id}-error`}>
            <FieldError>{error}</FieldError>
          </div>
        )}
      </Field>
    </div>
  )
}
export default KeyValue
