import { useId, useState, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Button, Field, FieldError, Input } from '../primitives/index.js'

type Props = Infer<typeof components.KeyValue.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}
type Entry = { key: string; value: string }

export function KeyValue({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? {}, bindings?.value)
  const [newEntry, setNewEntry] = useState<Entry>({ key: '', value: '' })
  const error = useFieldError(props.error, bindings?.value)
  const entries: Entry[] =
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value).map(([key, item]) => ({ key, value: String(item ?? '') }))
      : []
  function update(index: number, field: keyof Entry, next: string) {
    const nextEntries = entries.map((entry, i) => ({
      key: i === index && field === 'key' ? next : entry.key,
      value: i === index && field === 'value' ? next : entry.value,
    }))
    setValue(Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item])))
  }
  function addEntry() {
    if (!newEntry.key.trim()) return
    setValue({
      ...Object.fromEntries(entries.map(({ key, value: item }) => [key, item])),
      [newEntry.key]: newEntry.value,
    })
    setNewEntry({ key: '', value: '' })
  }
  function moveEntry(index: number, direction: -1 | 1) {
    const nextEntries = [...entries]
    const destination = index + direction
    if (destination < 0 || destination >= nextEntries.length) return
    ;[nextEntries[index], nextEntries[destination]] = [nextEntries[destination], nextEntries[index]]
    setValue(Object.fromEntries(nextEntries.map(({ key, value: item }) => [key, item])))
  }
  const generatedId = useId()
  const id = props.name ?? generatedId
  const describedBy =
    [props.hint && `${id}-hint`, props.helperText && `${id}-helper`, error && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  const columnStyle =
    props.columnSpan == null
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
        {props.label != null && (
          <p id={`${id}-label`} className="text-sm font-medium">
            {props.label}
            {props.required && <span aria-hidden="true"> *</span>}
          </p>
        )}
        <div className="grid gap-2">
          {entries.map((entry, index) => (
            <div key={`${index}-${entry.key}`} className="flex gap-2">
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
                  onClick={() =>
                    setValue(
                      Object.fromEntries(
                        entries
                          .filter((_, i) => i !== index)
                          .map(({ key, value: item }) => [key, item])
                      )
                    )
                  }
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
