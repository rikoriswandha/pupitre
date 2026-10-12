import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import {
  Button,
  Field,
  FieldError,
  Input,
  FieldDescription,
  InputGroup,
  InputSlot,
} from '../primitives/index.js'

import { InputFieldLabel } from './Text.js'

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
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="max-w-xs">
            <InputSlot>
              {/* Plain input: Input's control classes (px-3, :read-only fill) collapse the swatch. */}
              <input
                aria-label={props.label ?? id}
                {...props.extraAttributes}
                id={id}
                name={id}
                type="color"
                value={String(value || '#000000')}
                onChange={(event) => setValue(event.currentTarget.value)}
                disabled={props.disabled || props.readOnly}
                readOnly={props.readOnly}
                required={props.required}
                aria-required={props.required}
                aria-describedby={describedBy}
                aria-invalid={!!error}
                className="size-6 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              />
            </InputSlot>
            <Input
              bare
              aria-label={`${props.label ?? 'Color'} value`}
              value={String(value ?? '')}
              disabled={props.disabled || props.readOnly}
              readOnly={props.readOnly}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
          </InputGroup>
          {Array.isArray(props.presets) &&
            props.presets.map((color) => (
              <Button
                key={color}
                type="button"
                variant="outline"
                size="xs"
                square
                aria-label={`Choose ${color}`}
                title={color}
                disabled={props.disabled || props.readOnly}
                onClick={() => setValue(color)}
                style={{ backgroundColor: color }}
              />
            ))}
        </div>

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
export default Color
