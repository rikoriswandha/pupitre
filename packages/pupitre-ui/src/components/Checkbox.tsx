import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Field, FieldError, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Checkbox.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Checkbox({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? false, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
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
        <div className={props.inline ? 'inline-flex items-center gap-2' : 'flex items-start gap-2'}>
          <BaseCheckbox.Root
            {...props.extraAttributes}
            id={id}
            name={bindings?.value ? bindings.value.split('/').slice(2).join('.') : props.name}
            checked={!!value}
            onCheckedChange={(next) => setValue(next === true)}
            required={props.required}
            disabled={props.disabled}
            readOnly={props.readOnly}
            aria-label={props.label === null ? props.name : undefined}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className="mt-0.5 grid size-6 place-items-center rounded border border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground"
          >
            <BaseCheckbox.Indicator className="text-xs">✓</BaseCheckbox.Indicator>
          </BaseCheckbox.Root>
          <div className="grid gap-1">
            {props.label !== null && (
              <Label htmlFor={id}>
                {props.label ?? props.name}
                {props.required && <span aria-hidden="true"> *</span>}
              </Label>
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
          </div>
        </div>
        {error && (
          <div id={`${id}-error`}>
            <FieldError>{error}</FieldError>
          </div>
        )}
      </Field>
    </div>
  )
}
export default Checkbox
