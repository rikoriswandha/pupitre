import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Field as BaseField } from '@base-ui/react/field'
import {
  Button,
  CheckboxControl,
  Field,
  FieldError,
  Input,
  InputGroup,
  InputSlot,
} from '../primitives/index.js'
import { Icon } from '../icons.js'

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
  const [query, setQuery] = useState('')
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.description ?? ''}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase())
  )
  const editableOptions = options.filter((option) => !option.disabled)
  const allSelected =
    editableOptions.length > 0 &&
    editableOptions.every((option) =>
      selected.some((item) => String(item) === String(option.value))
    )
  function update(optionValue: string | number, checked: boolean | 'indeterminate') {
    const canonical =
      options.find((option) => String(option.value) === String(optionValue))?.value ?? optionValue
    const next =
      checked === true
        ? [...selected.filter((item) => String(item) !== String(optionValue)), canonical]
        : selected.filter((item) => String(item) !== String(optionValue))
    setValue(next)
  }
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
        <fieldset
          {...props.extraAttributes}
          className="grid min-w-0 gap-3"
          disabled={props.disabled}
          aria-describedby={describedBy}
          aria-invalid={!!error}
        >
          {props.label !== null && props.label !== undefined && (
            <legend className="mb-3 text-sm font-medium">
              {props.label}
              {props.required && <span aria-hidden="true"> *</span>}
            </legend>
          )}
          {props.searchable && (
            <InputGroup>
              <InputSlot>
                <Icon name="search" className="ml-2 size-4 text-muted-foreground" />
              </InputSlot>
              <Input
                bare
                aria-label="Search options"
                placeholder="Search options..."
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                disabled={props.disabled}
              />
            </InputGroup>
          )}
          {props.bulkToggleable && (
            <Button
              type="button"
              variant="link"
              color="primary"
              className="min-h-6 justify-self-start"
              disabled={props.disabled || props.readOnly || editableOptions.length === 0}
              onClick={() =>
                setValue(
                  allSelected
                    ? selected.filter(
                        (item) =>
                          !editableOptions.some((option) => String(option.value) === String(item))
                      )
                    : [
                        ...selected.filter(
                          (item) =>
                            !editableOptions.some((option) => String(option.value) === String(item))
                        ),
                        ...editableOptions.map((option) => option.value),
                      ]
                )
              }
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
          )}
          <div
            className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[repeat(var(--option-columns),minmax(0,1fr))]"
            style={{ '--option-columns': Math.max(1, Number(props.columns) || 1) } as CSSProperties}
          >
            {filteredOptions.map((option) => {
              const optionId = `${id}-${String(option.value)}`
              return (
                <BaseField.Item
                  key={String(option.value)}
                  className="flex min-h-6 items-start gap-2 text-sm"
                >
                  <CheckboxControl
                    {...props.extraAttributes}
                    id={optionId}
                    aria-labelledby={`${optionId}-label`}
                    name={
                      bindings?.value ? bindings.value.split('/').slice(2).join('.') : props.name
                    }
                    value={String(option.value)}
                    checked={selected.some((item) => String(item) === String(option.value))}
                    disabled={option.disabled || props.disabled}
                    readOnly={props.readOnly}
                    onCheckedChange={(checked) => update(option.value, checked)}
                    aria-required={props.required}
                    aria-describedby={
                      [describedBy, option.description && `${optionId}-description`]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    aria-invalid={!!error}
                    className="size-6"
                  />
                  <div className="grid min-w-0 gap-1">
                    <BaseField.Label
                      id={`${optionId}-label`}
                      htmlFor={optionId}
                      className="cursor-pointer text-sm font-medium leading-6"
                    >
                      {option.label}
                    </BaseField.Label>
                    {option.description && (
                      <p
                        id={`${optionId}-description`}
                        className="text-[0.8125rem] leading-5 text-muted-foreground"
                      >
                        {option.description}
                      </p>
                    )}
                  </div>
                </BaseField.Item>
              )
            })}
          </div>
          {filteredOptions.length === 0 && (
            <p className="text-[0.8125rem] text-muted-foreground">No matching options.</p>
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
