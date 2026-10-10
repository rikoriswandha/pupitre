import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Toggle as BaseToggle } from '@base-ui/react/toggle'
import { Field, FieldError } from '../primitives/index.js'

type Props = Infer<typeof components.ToggleButtons.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function ToggleButtons({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(
    props.value ?? (props.multiple ? [] : ''),
    bindings?.value
  )
  const error = useFieldError(props.error, bindings?.value)
  const options = Array.isArray(props.options) ? props.options : []
  const selected = (option: string | number) =>
    props.multiple
      ? Array.isArray(value) && value.some((item) => String(item) === String(option))
      : String(value) === String(option)
  const toggle = (option: string | number) => {
    if (!props.multiple) {
      setValue(options.find((entry) => String(entry.value) === String(option))?.value ?? option)
      return
    }
    const selectedValues = Array.isArray(value) ? value : []
    setValue(
      selected(option)
        ? selectedValues.filter((item) => String(item) !== String(option))
        : [
            ...selectedValues.filter((item) => String(item) !== String(option)),
            options.find((entry) => String(entry.value) === String(option))?.value ?? option,
          ]
    )
  }
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
        {props.label !== null && props.label !== undefined && (
          <p id={`${id}-label`} className="text-sm font-medium">
            {props.label}
            {props.required && <span aria-hidden="true"> *</span>}
          </p>
        )}
        <div
          {...props.extraAttributes}
          role="group"
          aria-labelledby={props.label ? `${id}-label` : undefined}
          aria-required={props.required}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`inline-flex w-fit overflow-hidden rounded-md border border-input ${props.grouped === false ? 'gap-2 border-0' : ''}`}
        >
          {options.map((option) => (
            <BaseToggle
              {...props.extraAttributes}
              key={String(option.value)}
              type="button"
              value={String(option.value)}
              pressed={selected(option.value)}
              disabled={props.disabled || props.readOnly || option.disabled}
              onPressedChange={() => toggle(option.value)}
              aria-required={props.required}
              aria-describedby={describedBy}
              aria-invalid={!!error}
              style={{ color: props.colors?.[String(option.value)] }}
              className={`min-h-9 px-3 text-sm transition-colors data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[unpressed]:bg-background data-[unpressed]:hover:bg-muted ${props.grouped === false ? 'rounded-md border border-input' : 'border-r border-input last:border-r-0'}`}
            >
              {props.icons?.[String(option.value)] && (
                <span aria-hidden="true" className="mr-2">
                  {props.icons[String(option.value)]}
                </span>
              )}
              {option.label}
            </BaseToggle>
          ))}
        </div>
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
export default ToggleButtons
