import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Field, FieldError, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Radio.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Radio({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? '', bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const options = Array.isArray(props.options) ? props.options : []
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
        <fieldset
          className="grid gap-2"
          disabled={props.disabled}
          aria-required={props.required}
          aria-describedby={describedBy}
          aria-invalid={!!error}
        >
          {props.label != null && (
            <legend className="text-sm font-medium">
              {props.label}
              {props.required && <span aria-hidden="true"> *</span>}
            </legend>
          )}
          <RadioGroup
            {...props.extraAttributes}
            name={props.name}
            value={value == null ? undefined : String(value)}
            onValueChange={(next) =>
              setValue(options.find((option) => String(option.value) === next)?.value ?? next)
            }
            required={props.required}
            disabled={props.disabled}
            readOnly={props.readOnly}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className={`grid gap-2 ${props.inline ? 'sm:flex sm:flex-wrap' : ''}`}
          >
            {options.map((option) => {
              const optionId = `${id}-${String(option.value)}`
              const description = props.descriptions?.[String(option.value)] ?? option.description
              return (
                <div key={String(option.value)} className="flex items-start gap-2 text-sm">
                  <BaseRadio.Root
                    {...props.extraAttributes}
                    id={optionId}
                    value={String(option.value)}
                    disabled={option.disabled || props.disabled || props.readOnly}
                    aria-required={props.required}
                    aria-describedby={describedBy}
                    aria-invalid={!!error}
                    className="mt-0.5 grid size-4 place-items-center rounded-full border border-input data-[checked]:border-primary"
                  >
                    <BaseRadio.Indicator className="size-2 rounded-full bg-primary" />
                  </BaseRadio.Root>
                  <div>
                    <Label htmlFor={optionId}>{option.label}</Label>
                    {description && <p className="text-muted-foreground">{description}</p>}
                  </div>
                </div>
              )
            })}
          </RadioGroup>
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
        </fieldset>
      </Field>
    </div>
  )
}
export default Radio
