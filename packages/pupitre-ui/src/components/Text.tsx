import { useId, useState, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Button, Field, FieldError, Input, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Text.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Text({ props, bindings }: Runtime) {
  const [showPassword, setShowPassword] = useState(false)
  const [value, setValue] = useBoundValue(props.value ?? '', bindings?.value)
  const error = useFieldError(props.error, bindings?.value)
  const generatedId = useId()
  const id = props.name ?? generatedId
  const listId = props.datalist?.length ? `${id}-options` : undefined
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
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          {props.prefix && <span className="text-sm text-muted-foreground">{props.prefix}</span>}
          <Input
            {...props.extraAttributes}
            id={id}
            name={id}
            type={
              props.type === 'password' && props.revealable && showPassword
                ? 'text'
                : (props.type ?? 'text')
            }
            value={value ?? ''}
            onChange={(event) => setValue(event.currentTarget.value)}
            placeholder={props.placeholder}
            maxLength={props.maxLength}
            autoComplete={props.autocomplete}
            list={listId}
            required={props.required}
            disabled={props.disabled}
            readOnly={props.readOnly}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            className="h-10 min-w-0 flex-1 border-0 bg-transparent shadow-none outline-none focus-visible:ring-0"
          />
          {props.revealable && props.type === 'password' && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={props.disabled}
              className="min-h-8 px-2 text-xs"
            >
              {showPassword ? 'Hide' : 'Show'}
            </Button>
          )}
        </div>
        {listId && (
          <datalist id={listId}>
            {props.datalist?.map((item: string) => (
              <option key={item} value={item} />
            ))}
          </datalist>
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
      </Field>
    </div>
  )
}
export default Text
