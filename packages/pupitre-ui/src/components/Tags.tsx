import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { t, useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import {
  Button,
  Field,
  FieldError,
  Input,
  FieldDescription,
  Badge,
  cn,
  controlGroupClasses,
  popupClasses,
  menuItemClasses,
} from '../primitives/index.js'
import { useLiveField } from './use_live_field.js'

import { Icon } from '../icons.js'
import { InputFieldLabel } from './Text.js'

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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
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
        <InputFieldLabel id={id} props={props} />
        <div
          data-tags-control=""
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false)
          }}
        >
          <div
            className={cn(
              controlGroupClasses,
              'min-h-(--control-h) flex-wrap items-center gap-1 px-1 py-0.5'
            )}
          >
            {tags.map((tag, index) => (
              <Badge key={tag} className="py-0 pr-0.5">
                {tag}
                {props.reorderable && (
                  <>
                    <Button
                      variant="ghost"
                      size="xs"
                      square
                      type="button"
                      aria-label={t('Move {label} earlier', { label: tag })}
                      disabled={props.disabled || props.readOnly || index === 0}
                      onClick={() => moveTag(index, -1)}
                      className="size-6 rounded-sm"
                    >
                      <Icon name="arrow-up" className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      square
                      type="button"
                      aria-label={t('Move {label} later', { label: tag })}
                      disabled={props.disabled || props.readOnly || index === tags.length - 1}
                      onClick={() => moveTag(index, 1)}
                      className="size-6 rounded-sm"
                    >
                      <Icon name="arrow-down" className="size-3.5" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  square
                  type="button"
                  aria-label={t('Remove {label}', { label: tag })}
                  disabled={props.disabled || props.readOnly}
                  onClick={() => changeValue(tags.filter((item) => item !== tag))}
                  className="size-6 rounded-sm"
                >
                  <Icon name="x" className="size-3.5" />
                </Button>
              </Badge>
            ))}
            <Input
              bare
              {...props.extraAttributes}
              id={id}
              name={bindings?.value ? bindings.value.split('/').slice(2).join('.') : props.name}
              value={draft}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => commitValue()}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Escape') setSuggestionsOpen(false)
                if (event.key === 'ArrowDown') {
                  const option = event.currentTarget
                    .closest('[data-tags-control]')
                    ?.querySelector<HTMLButtonElement>('[role="option"]')
                  if (option) {
                    event.preventDefault()
                    option.focus()
                  }
                }
                if (
                  !props.readOnly &&
                  (event.key === 'Enter' || event.key === (props.separator ?? ','))
                ) {
                  event.preventDefault()
                  add()
                }
              }}
              disabled={
                props.disabled || props.readOnly || tags.length >= (props.maxTags ?? Infinity)
              }
              placeholder={t('Add a tag')}
              readOnly={props.readOnly}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              className="h-6 min-w-32 flex-1 px-2"
            />
          </div>
          {suggestionsOpen &&
            !props.disabled &&
            !props.readOnly &&
            suggestions.filter(
              (tag) => !tags.includes(tag) && tag.toLowerCase().includes(draft.toLowerCase())
            ).length > 0 && (
              <div
                role="listbox"
                aria-label={t('Tag suggestions')}
                className={`${popupClasses} absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto`}
                onKeyDown={(event) => {
                  const options = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')
                  )
                  const index = options.indexOf(document.activeElement as HTMLButtonElement)
                  const next =
                    event.key === 'ArrowDown'
                      ? options[(index + 1) % options.length]
                      : event.key === 'ArrowUp'
                        ? options[(index - 1 + options.length) % options.length]
                        : undefined
                  if (next) {
                    event.preventDefault()
                    next.focus()
                  }
                  if (event.key === 'Escape') {
                    event.currentTarget
                      .closest('[data-tags-control]')
                      ?.querySelector<HTMLInputElement>('input')
                      ?.focus()
                    setSuggestionsOpen(false)
                  }
                }}
              >
                {suggestions
                  .filter(
                    (tag) => !tags.includes(tag) && tag.toLowerCase().includes(draft.toLowerCase())
                  )
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className={`${menuItemClasses} hover:bg-accent focus-visible:bg-accent`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        if (tags.length < (props.maxTags ?? Infinity)) {
                          event.currentTarget
                            .closest('[data-tags-control]')
                            ?.querySelector<HTMLInputElement>('input')
                            ?.focus()
                          changeValue([...tags, tag])
                          setDraft('')
                          setSuggestionsOpen(false)
                        }
                      }}
                    >
                      {tag}
                    </button>
                  ))}
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
export default Tags
