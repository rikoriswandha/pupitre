import { useId, useRef, useState, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Button, Field, FieldError, Input } from '../primitives/index.js'
import { useLiveField } from './use_live_field.js'

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
    setEntries(nextEntries)
    changeValue(Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item])))
    setNewEntry({ id: 'new', key: '', value: '' })
  }
  function moveEntry(index: number, direction: -1 | 1) {
    const nextEntries = [...entries]
    const destination = index + direction
    if (destination < 0 || destination >= nextEntries.length) return
    ;[nextEntries[index], nextEntries[destination]] = [nextEntries[destination], nextEntries[index]]
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
        {props.label !== null && props.label !== undefined && (
          <p id={`${id}-label`} className="text-sm font-medium">
            {props.label}
            {props.required && <span aria-hidden="true"> *</span>}
          </p>
        )}
        <div className="grid gap-2">
          {entries.map((entry, index) => (
            <div key={entry.id} className="flex gap-2">
              <Input
                {...props.extraAttributes}
                aria-label={props.keyLabel ?? 'Key'}
                aria-labelledby={`${id}-label`}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                value={entry.key}
                disabled={props.disabled || props.readOnly}
                placeholder={props.keyPlaceholder}
                onChange={(event) => update(index, 'key', event.currentTarget.value)}
                onBlur={() => commitValue()}
                className="min-w-0 flex-1"
              />
              <Input
                {...props.extraAttributes}
                aria-label={props.valueLabel ?? 'Value'}
                aria-labelledby={`${id}-label`}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                value={entry.value}
                disabled={props.disabled || props.readOnly}
                placeholder={props.valuePlaceholder}
                onChange={(event) => update(index, 'value', event.currentTarget.value)}
                onBlur={() => commitValue()}
                className="min-w-0 flex-1"
              />
              {props.reorderable && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Move ${entry.key} up`}
                    disabled={props.disabled || props.readOnly || index === 0}
                    onClick={() => moveEntry(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Move ${entry.key} down`}
                    disabled={props.disabled || props.readOnly || index === entries.length - 1}
                    onClick={() => moveEntry(index, 1)}
                  >
                    ↓
                  </Button>
                </div>
              )}
              {props.deletable !== false && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={props.disabled}
                  aria-label={`Remove ${entry.key}`}
                  onClick={() => {
                    const nextEntries = entries.filter((_, i) => i !== index)
                    setEntries(nextEntries)
                    changeValue(
                      Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item]))
                    )
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {props.addable !== false && (
          <div className="flex gap-2">
            <Input
              {...props.extraAttributes}
              aria-label={props.keyLabel ?? 'Key'}
              aria-labelledby={`${id}-label`}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              value={newEntry.key}
              onChange={(event) => setNewEntry({ ...newEntry, key: event.currentTarget.value })}
              placeholder={props.keyPlaceholder}
              disabled={props.disabled}
              className="min-w-0 flex-1"
            />
            <Input
              {...props.extraAttributes}
              aria-label={props.valueLabel ?? 'Value'}
              aria-labelledby={`${id}-label`}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              value={newEntry.value}
              onChange={(event) => setNewEntry({ ...newEntry, value: event.currentTarget.value })}
              placeholder={props.valuePlaceholder}
              disabled={props.disabled}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={props.disabled || !newEntry.key.trim()}
              onClick={addEntry}
            >
              Add
            </Button>
          </div>
        )}
        {props.hint && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {props.hint}
          </p>
        )}
        {props.helperText && (
          <p id={`${id}-helper`} className="text-sm text-muted-foreground">
            {props.helperText}
          </p>
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
