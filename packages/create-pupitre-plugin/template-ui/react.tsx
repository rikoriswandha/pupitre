import { useId } from 'react'
import { t, useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { z } from 'zod'
import type { catalogNamePlaceholder } from './catalog.js'

type Props = z.infer<typeof catalogNamePlaceholder.components.__componentName__.props>

export function __componentName__({
  props,
  bindings,
}: {
  props: Props
  bindings?: Record<string, string | undefined>
}) {
  const id = useId()
  const [value, setValue] = useBoundValue(props.value ?? null, bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const describedBy =
    [props.helperText && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') ||
    undefined

  return (
    <div>
      <label htmlFor={id}>{props.label ?? t('Rating')}</label>
      <input
        id={id}
        name={props.name}
        type="number"
        min={0}
        max={props.max ?? 5}
        step={1}
        value={value ?? ''}
        required={props.required}
        disabled={props.disabled}
        readOnly={props.readOnly}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(event) =>
          setValue(event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber)
        }
      />
      {props.helperText && <p id={`${id}-help`}>{props.helperText}</p>}
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export const components = { __componentName__ }
