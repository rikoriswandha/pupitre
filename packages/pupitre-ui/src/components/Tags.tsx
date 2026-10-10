import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Button, Field, FieldError, Input, Label } from '../primitives/index.js'
import { useLiveField } from './use_live_field.js'

type Props = Infer<typeof components.Tags.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Tags({ props, bindings }: Runtime) {
  const [boundValue, setValue] = useBoundValue(props.value ?? [], bindings?.value)
  const [value, changeValue, commitValue] = useLiveField(boundValue, setValue, props.live)
  const [draft, setDraft] = useState('')
  const error = useFieldError(props.error, bindings?.value)
  const tags = Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === 'string')
    : []
  const suggestions = Array.isArray(props.suggestions) ? props.suggestions : []
  function add() {
    const tag = draft.trim()
    if (!tag || tags.includes(tag) || tags.length >= (props.maxTags ?? Infinity)) return
    changeValue([...tags, tag])
    setDraft('')
  }
  function moveTag(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= tags.length) return
    const next = [...tags]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    changeValue(next)
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
          <Label htmlFor={id}>
            {props.label}
            {props.required && <span aria-hidden="true"> *</span>}
          </Label>
        )}
        <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input bg-background p-2">
          {tags.map((tag, index) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-sm"
            >
              {tag}
              {props.reorderable && (
                <>
                  <Button
                    variant="ghost"
                    type="button"
                    aria-label={`Move ${tag} earlier`}
                    disabled={props.disabled || props.readOnly || index === 0}
                    onClick={() => moveTag(index, -1)}
                    className="min-h-6 px-1"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    aria-label={`Move ${tag} later`}
                    disabled={props.disabled || props.readOnly || index === tags.length - 1}
                    onClick={() => moveTag(index, 1)}
                    className="min-h-6 px-1"
                  >
                    ↓
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                type="button"
                aria-label={`Remove ${tag}`}
                disabled={props.disabled || props.readOnly}
                onClick={() => changeValue(tags.filter((item) => item !== tag))}
                className="min-h-6 px-1"
              >
                ×
              </Button>
            </span>
          ))}
          <Input
            {...props.extraAttributes}
            id={id}
            name={props.name}
            value={draft}
            onBlur={() => commitValue()}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (
                !props.readOnly &&
                (event.key === 'Enter' || event.key === (props.separator ?? ','))
              ) {
                event.preventDefault()
                add()
              }
            }}
            list={suggestions.length ? `${id}-suggestions` : undefined}
            disabled={
              props.disabled || props.readOnly || tags.length >= (props.maxTags ?? Infinity)
            }
            placeholder="Add a tag"
            readOnly={props.readOnly}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className="h-8 min-w-32 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
        {suggestions.length > 0 && (
          <datalist id={`${id}-suggestions`}>
            {suggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
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
export default Tags
