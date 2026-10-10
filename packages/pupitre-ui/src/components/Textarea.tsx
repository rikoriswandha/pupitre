import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Field, FieldError, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Textarea.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Textarea({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? '', bindings?.value)
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
        <textarea
          aria-label={props.label ?? id}
          {...props.extraAttributes}
          id={id}
          name={id}
          value={value ?? ''}
          onChange={(event) => setValue(event.currentTarget.value)}
          rows={props.rows ?? 4}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          required={props.required}
          disabled={props.disabled}
          readOnly={props.readOnly}
          aria-required={props.required}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
export default Textarea
