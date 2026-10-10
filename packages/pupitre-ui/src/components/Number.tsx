import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { Field, FieldError, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Number.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Number({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? '', bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
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
          <Label htmlFor={id}>
            {props.label}
            {props.required && <span aria-hidden="true"> *</span>}
          </Label>
        )}
        <BaseNumberField.Root
          value={value === '' || value == null ? null : globalThis.Number(value)}
          onValueChange={(next) => setValue(next ?? '')}
          min={props.min}
          max={props.max}
          step={props.step}
          required={props.required}
          disabled={props.disabled}
          readOnly={props.readOnly}
        >
          <BaseNumberField.Group className="flex items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
            {props.prefix && <span className="text-sm text-muted-foreground">{props.prefix}</span>}
            <BaseNumberField.Input
              {...props.extraAttributes}
              id={id}
              name={id}
              inputMode={props.inputMode ?? 'decimal'}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <BaseNumberField.Decrement
              aria-label="Decrease value"
              className="rounded border border-input px-2 text-sm"
            >
              −
            </BaseNumberField.Decrement>
            <BaseNumberField.Increment
              aria-label="Increase value"
              className="rounded border border-input px-2 text-sm"
            >
              +
            </BaseNumberField.Increment>
            {props.suffix && <span className="text-sm text-muted-foreground">{props.suffix}</span>}
          </BaseNumberField.Group>
        </BaseNumberField.Root>
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
export default Number
