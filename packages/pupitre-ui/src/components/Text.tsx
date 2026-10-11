import { useId, useState, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Button, Field, FieldError, Input, Label } from '../primitives/index.js'
import { ActionButton } from './ActionButton.js'
import { Icon } from '../icons.js'
import { useLiveField } from './use_live_field.js'

type Props = Infer<typeof components.Text.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function formatInputMask(value: string, mask: string): string {
  let valueIndex = 0
  let formatted = ''
  for (let maskIndex = 0; maskIndex < mask.length && valueIndex < value.length; maskIndex++) {
    const token = mask[maskIndex]!
    if (token === '9' || token === 'a' || token === '*') {
      while (valueIndex < value.length) {
        const character = value[valueIndex++]!
        if (
          (token === '9' && /\d/.test(character)) ||
          (token === 'a' && /[a-z]/i.test(character)) ||
          (token === '*' && /[a-z0-9]/i.test(character))
        ) {
          formatted += character
          break
        }
      }
    } else {
      formatted += token
    }
  }
  return formatted
}

export function unmaskInput(value: string, mask: string): string {
  let inputIndex = 0
  let result = ''
  for (const token of mask) {
    if (inputIndex >= value.length) break
    if (token !== '9' && token !== 'a' && token !== '*') {
      if (value[inputIndex] === token) inputIndex++
      continue
    }
    while (inputIndex < value.length) {
      const character = value[inputIndex++]!
      if (
        (token === '9' && /\d/.test(character)) ||
        (token === 'a' && /[a-z]/i.test(character)) ||
        (token === '*' && /[a-z0-9]/i.test(character))
      ) {
        result += character
        break
      }
    }
  }
  return result
}
export function Text({ props, bindings }: Runtime) {
  const [showPassword, setShowPassword] = useState(false)
  const [boundValue, setValue] = useBoundValue(props.value ?? '', bindings?.value)
  const [value, changeValue, commitValue] = useLiveField(boundValue, setValue, props.live)
  const error = useFieldError(props.error, bindings?.value)
  const generatedId = useId()
  const id = bindings?.value
    ? bindings.value.split('/').slice(2).join('.')
    : (props.name ?? generatedId)
  const listId = props.datalist?.length ? `${id}-options` : undefined
  const describedBy =
    [props.hint && `${id}-hint`, props.helperText && `${id}-helper`, error && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined
  const displayedValue = props.mask
    ? formatInputMask(String(value ?? ''), props.mask)
    : String(value ?? '')
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
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={id}>
              {props.label}
              {props.required && <span aria-hidden="true"> *</span>}
            </Label>
            {props.hintAction && <ActionButton action={props.hintAction} />}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          {props.prefixAction && <ActionButton action={props.prefixAction} />}
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
            value={displayedValue}
            onChange={(event) => {
              const inputValue = event.currentTarget.value
              changeValue(props.mask ? unmaskInput(inputValue, props.mask) : inputValue)
            }}
            onBlur={() => commitValue()}
            placeholder={props.placeholder}
            maxLength={props.mask ? undefined : props.maxLength}
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
          {props.suffix && <span className="text-sm text-muted-foreground">{props.suffix}</span>}
          {props.suffixAction && <ActionButton action={props.suffixAction} />}
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
          <p
            id={`${id}-hint`}
            className="flex items-center gap-1 text-sm text-muted-foreground"
            style={props.hintColor ? { color: props.hintColor } : undefined}
          >
            {props.hintIcon && (
              <span title={props.hintTooltip} aria-label={props.hintTooltip ?? undefined}>
                <Icon name={props.hintIcon} className="size-4" />
              </span>
            )}
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
