import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { Field, FieldError, Label } from '../primitives/index.js'

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
        <div
          className={props.inline ? 'inline-flex items-center gap-3 text-sm' : 'grid gap-2 text-sm'}
        >
          <BaseSwitch.Root
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
            className="relative h-6 w-11 rounded-full bg-muted-foreground/40 transition-colors data-[disabled]:opacity-50"
            style={{
              backgroundColor: checked
                ? (props.onColor ?? undefined)
                : (props.offColor ?? undefined),
            }}
          >
            <BaseSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white transition-transform data-[checked]:translate-x-5" />
          </BaseSwitch.Root>
          <div className="grid gap-1">
            {props.label !== null && (
              <Label htmlFor={id}>
                {props.label ?? props.name}
                {props.required && <span aria-hidden="true"> *</span>}
              </Label>
            )}
            <span className="sr-only">
              {checked ? (props.onIcon ?? 'On') : (props.offIcon ?? 'Off')}
            </span>
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
export default Toggle
