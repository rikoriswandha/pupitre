import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import {
  Field,
  FieldError,
  Input,
  FieldDescription,
  InputGroup,
  InputSlot,
} from '../primitives/index.js'
import { timezoneHint, toInputValue } from '../primitives/date_value.js'

import { Icon } from '../icons.js'
import { InputFieldLabel } from './Text.js'

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
  const id = bindings?.value
    ? bindings.value.split('/').slice(2).join('.')
    : (props.name ?? generatedId)
  const zoneHint = timezoneHint(props.timezone)
  const describedBy =
    [
      props.hint && `${id}-hint`,
      props.helperText && `${id}-helper`,
      zoneHint && `${id}-timezone`,
      error && `${id}-error`,
    ]
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
        <InputGroup>
          <InputSlot>
            <Icon name="calendar" className="ml-2 size-4 text-muted-foreground" />
          </InputSlot>
          <Input
            bare
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
          />
        </InputGroup>
        {zoneHint && <FieldDescription id={`${id}-timezone`}>{zoneHint}</FieldDescription>}

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
export default Date
