import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Button, Field, FieldError, Input, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Color.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Color({ props, bindings }: Runtime) {
  const [value, setValue] = useBoundValue(props.value ?? '#000000', bindings?.value)
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
        {props.label != null && (
          <Label htmlFor={id}>
            {props.label}
            {props.required && <span aria-hidden="true"> *</span>}
          </Label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            {...props.extraAttributes}
            id={id}
            name={id}
            type="color"
            value={String(value || '#000000')}
            onChange={(event) => setValue(event.currentTarget.value)}
            disabled={props.disabled}
            readOnly={props.readOnly}
            required={props.required}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className="size-10 rounded-md p-1"
          />
          <output htmlFor={id} className="text-sm text-muted-foreground">
            {String(value ?? '')}
          </output>
          {Array.isArray(props.presets) &&
            props.presets.map((color) => (
              <Button
                key={color}
                type="button"
                variant="outline"
                aria-label={`Choose ${color}`}
                title={color}
                disabled={props.disabled}
                onClick={() => setValue(color)}
                className="size-7 min-h-7 rounded-full p-0"
                style={{ backgroundColor: color }}
              />
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
export default Color
