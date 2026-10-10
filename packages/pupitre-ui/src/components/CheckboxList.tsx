import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Field, FieldError } from '../primitives/index.js'

type Props = Infer<typeof components.CheckboxList.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function CheckboxList({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? [], bindings?.value)
  const options = Array.isArray(props.options) ? props.options : []
  const selected = Array.isArray(value) ? value : []
  function update(optionValue: string | number, checked: boolean | 'indeterminate') {
    const next = checked === true
      ? [...selected.filter((item) => item !== optionValue), optionValue]
      : selected.filter((item) => item !== optionValue)
    setValue(next)
  }
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
        <fieldset
          {...props.extraAttributes}
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
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, Number(props.columns) || 1)}, minmax(0, 1fr))`,
            }}
          >
            {options.map((option) => {
              const optionId = `${id}-${String(option.value)}`
              return (
                <label
                  key={String(option.value)}
                  htmlFor={optionId}
                  className="flex items-center gap-2 text-sm"
                >
                  <BaseCheckbox.Root
                    {...props.extraAttributes}
                    id={optionId}
                    name={props.name}
                    value={String(option.value)}
                    checked={selected.includes(option.value)}
                    disabled={option.disabled || props.disabled}
                    readOnly={props.readOnly}
                    onCheckedChange={(checked) => update(option.value, checked)}
                    aria-required={props.required}
                    aria-describedby={describedBy}
                    aria-invalid={!!error}
                    className="grid size-4 place-items-center rounded border border-input data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground"
                  >
                    <BaseCheckbox.Indicator className="text-xs">✓</BaseCheckbox.Indicator>
                  </BaseCheckbox.Root>
                  {option.label}
                </label>
              )
            })}
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
        </fieldset>
      </Field>
    </div>
  )
}
export default CheckboxList
