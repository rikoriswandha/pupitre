import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Field, FieldError, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Select.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Select({ props, bindings }: Runtime) {
  const initial = props.value ?? (props.multiple ? [] : '')
  const [value, setValue] = useBoundValue(initial, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const generatedId = useId()
  const id = props.name ?? generatedId
  const options = Array.isArray(props.options) ? props.options : []
  const selectedOptions = Array.isArray(value)
    ? options.filter((option) => value.some((selectedValue) => selectedValue === option.value))
    : (options.find((option) => option.value === value) ?? null)
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
        <BaseSelect.Root
          items={options}
          id={id}
          name={id}
          value={selectedOptions}
          onValueChange={(next) => {
            if (Array.isArray(next)) {
              setValue(next.map((option) => option.value))
              return
            }
            setValue(next?.value ?? '')
          }}
          multiple={props.multiple}
          required={props.required}
          disabled={props.disabled}
          readOnly={props.readOnly}
        >
          <BaseSelect.Trigger
            aria-label={props.label ?? id}
            {...props.extraAttributes}
            id={id}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <BaseSelect.Value placeholder={props.placeholder ?? 'Select an option'} />
            <BaseSelect.Icon aria-hidden="true">⌄</BaseSelect.Icon>
          </BaseSelect.Trigger>
          <BaseSelect.Portal>
            <BaseSelect.Positioner className="z-50 outline-none">
              <BaseSelect.Popup className="max-h-64 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                <BaseSelect.List>
                  {options.map((option) => (
                    <BaseSelect.Item
                      key={String(option.value)}
                      value={option}
                      disabled={option.disabled}
                      className="flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50"
                    >
                      <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                    </BaseSelect.Item>
                  ))}
                </BaseSelect.List>
              </BaseSelect.Popup>
            </BaseSelect.Positioner>
          </BaseSelect.Portal>
        </BaseSelect.Root>
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
export default Select
