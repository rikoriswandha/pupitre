import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { useLiveField } from './use_live_field.js'
import {
  Field,
  FieldError,
  FieldDescription,
  controlGroupClasses,
  bareControlClasses,
  InputAddon,
  InputSlot,
  buttonClasses,
} from '../primitives/index.js'

import { Icon } from '../icons.js'
import { InputFieldLabel } from './Text.js'

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
  const [boundValue, setValue] = useBoundValue(props.value ?? '', bindings?.value)
  const [value, changeValue, commitValue] = useLiveField(boundValue, setValue, props.live)
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
        <InputFieldLabel id={id} props={props} />
        <BaseNumberField.Root
          value={
            value === '' || value === null || value === undefined ? null : globalThis.Number(value)
          }
          onValueChange={(next) => changeValue(next ?? '')}
          min={props.min}
          max={props.max}
          step={props.step}
          required={props.required}
          disabled={props.disabled}
          readOnly={props.readOnly}
        >
          <BaseNumberField.Group className={`${controlGroupClasses} h-(--control-h)`}>
            {props.prefix && <InputAddon>{props.prefix}</InputAddon>}
            <BaseNumberField.Input
              aria-label={props.label ?? id}
              {...props.extraAttributes}
              id={id}
              name={id}
              inputMode={props.inputMode ?? 'decimal'}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              onBlur={() => commitValue()}
              className={bareControlClasses}
            />
            <InputSlot>
              <BaseNumberField.Decrement
                aria-controls={id}
                aria-label="Decrease value"
                className={buttonClasses({ variant: 'ghost', size: 'xs', square: true })}
              >
                <Icon name="minus" className="size-4" />
              </BaseNumberField.Decrement>
              <BaseNumberField.Increment
                aria-controls={id}
                aria-label="Increase value"
                className={buttonClasses({ variant: 'ghost', size: 'xs', square: true })}
              >
                <Icon name="plus" className="size-4" />
              </BaseNumberField.Increment>
            </InputSlot>
            {props.suffix && <InputAddon position="end">{props.suffix}</InputAddon>}
          </BaseNumberField.Group>
        </BaseNumberField.Root>

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
export default Number
