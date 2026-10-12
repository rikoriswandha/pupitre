import { useId } from 'react'
import { t, useBoundValue, useFieldError } from '@rikology/pupitre-react'
import { Field, FieldDescription, FieldError, Icon, RequiredMark } from '@rikology/pupitre-ui'
import type { RatingProps } from '../../../admin/rating_catalog.js'

type Runtime = { props: RatingProps; bindings?: Record<string, string | undefined> }

/** Native radio semantics provide arrow-key selection, Space and roving focus. */
export function StarRating({ props, bindings }: Runtime) {
  const generatedId = useId()
  const id = `rating-${generatedId}`
  const [value, setValue] = useBoundValue(props.value ?? 0, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const max = props.max ?? 5
  const describedBy =
    [props.helperText && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') ||
    undefined
  return (
    <div
      style={
        props.columnSpan
          ? { gridColumn: props.columnSpan === 'full' ? '1 / -1' : `span ${props.columnSpan}` }
          : undefined
      }
    >
      <Field invalid={!!error}>
        <fieldset
          disabled={props.disabled || props.readOnly}
          aria-describedby={describedBy}
          aria-invalid={!!error}
        >
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            {props.label ?? t('Rating')}
            {props.required && <RequiredMark />}
          </legend>
          <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: max + 1 }, (_, score) => (
              <label
                key={score}
                className="relative flex size-8 cursor-pointer items-center justify-center rounded-md border border-border text-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring hover:bg-muted"
              >
                <input
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  type="radio"
                  name={bindings?.value ?? id}
                  value={score}
                  checked={Number(value) === score}
                  onChange={() => setValue(score)}
                  aria-label={
                    score === 0
                      ? t('No rating')
                      : t('{count} of {max} stars', { count: score, max })
                  }
                  aria-describedby={describedBy}
                />
                <Icon
                  name={score === 0 ? 'x' : 'star'}
                  className={score > 0 && score <= Number(value) ? 'size-4 fill-current' : 'size-4'}
                />
              </label>
            ))}
          </div>
        </fieldset>
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

export function StarRatingColumn({ props }: Runtime) {
  const value = Number(props.value ?? 0)
  const max = props.max ?? 5
  return (
    <span
      className="inline-flex items-center gap-1 text-primary"
      role="img"
      aria-label={t('{count} of {max} stars', { count: value, max })}
    >
      {Array.from({ length: max }, (_, index) => (
        <Icon
          key={index}
          name="star"
          className={index < value ? 'size-4 fill-current' : 'size-4'}
        />
      ))}
      <span className="ml-1 text-xs tabular-nums text-muted-foreground" aria-hidden="true">
        {value}/{max}
      </span>
    </span>
  )
}

export function StarRatingEntry({ props }: Runtime) {
  return (
    <div
      className="grid gap-1.5"
      style={
        props.columnSpan
          ? { gridColumn: props.columnSpan === 'full' ? '1 / -1' : `span ${props.columnSpan}` }
          : undefined
      }
    >
      <span className="text-sm font-medium text-muted-foreground">
        {props.label ?? t('Rating')}
      </span>
      <StarRatingColumn props={props} />
    </div>
  )
}
