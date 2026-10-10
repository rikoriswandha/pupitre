import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Field, FieldError, Input, Label } from '../primitives/index.js'
import { toInputValue } from '../primitives/date_value.js'

type Props = Infer<typeof components.Date.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Date({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue<string | null>(props.value ?? null, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const generatedId = useId()
  const id = props.name ?? generatedId
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
        <Input
          aria-label={props.label ?? id}
          {...props.extraAttributes}
          id={id}
          name={id}
          type="date"
          value={toInputValue(value, 'date', props.seconds === true)}
          min={props.min}
          max={props.max}
          disabled={props.disabled}
          required={props.required}
          readOnly={props.readOnly}
          onChange={(event) => setValue(event.currentTarget.value || null)}
          aria-required={props.required}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className="h-10 w-full"
        />
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
export default Date
