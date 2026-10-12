import { useId, type ReactNode } from 'react'
import { t, useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { SwitchControl, Field, FieldDescription, FieldError, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Toggle.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Toggle({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? false, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const checked = !!value
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
        <div className={props.inline ? 'inline-flex items-start gap-3' : 'flex items-start gap-3'}>
          <SwitchControl
            {...props.extraAttributes}
            id={id}
            name={bindings?.value ? bindings.value.split('/').slice(2).join('.') : props.name}
            checked={checked}
            onCheckedChange={(next) => setValue(next === true)}
            required={props.required}
            disabled={props.disabled}
            readOnly={props.readOnly}
            aria-label={props.label === null ? props.name : undefined}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className="mt-0.5"
            style={{
              backgroundColor: checked
                ? (props.onColor ?? undefined)
                : (props.offColor ?? undefined),
            }}
          />
          <div className="grid min-w-0 gap-1">
            {props.label !== null && (
              <Label htmlFor={id}>
                {props.label ?? props.name}
                {props.required && <span aria-hidden="true"> *</span>}
              </Label>
            )}
            <span className="sr-only">
              {checked ? (props.onIcon ?? t('On')) : (props.offIcon ?? t('Off'))}
            </span>
            {props.hint && <FieldDescription id={`${id}-hint`}>{props.hint}</FieldDescription>}
            {props.helperText && (
              <FieldDescription id={`${id}-helper`}>{props.helperText}</FieldDescription>
            )}
            {error && (
              <div id={`${id}-error`}>
                <FieldError>{error}</FieldError>
              </div>
            )}
          </div>
        </div>
      </Field>
    </div>
  )
}
export default Toggle
