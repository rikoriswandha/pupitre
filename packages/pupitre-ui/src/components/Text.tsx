import { useId, useState, type ReactNode } from 'react'
import { t, useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import {
  Button,
  Field,
  FieldError,
  Input,
  InputGroup,
  InputAddon,
  InputSlot,
  Label,
  FieldDescription,
  RequiredMark,
  Tooltip,
} from '../primitives/index.js'
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

/** Label-row anatomy shared by the input fields. */
export function InputFieldLabel({
  id,
  props,
  fallback,
}: {
  id: string
  props: {
    label?: string | null
    required?: boolean
    hint?: string | null
    hintIcon?: string | null
    hintTooltip?: string | null
    hintColor?: string | null
    hintAction?: Infer<typeof components.Text.props>['hintAction']
  }
  fallback?: string
}) {
  return (
    <div data-input-label className="flex min-w-0 items-center justify-between gap-3">
      {props.label !== null && (props.label !== undefined || fallback) && (
        <Label id={`${id}-label`} htmlFor={id}>
          {props.label ?? fallback}
          {props.required && <RequiredMark />}
        </Label>
      )}
      <div className="ml-auto flex h-5 items-center gap-2 whitespace-nowrap text-[0.8125rem] text-muted-foreground">
        {(props.hint || props.hintIcon) && (
          <span
            id={`${id}-hint`}
            className="flex items-center gap-1"
            style={props.hintColor ? { color: props.hintColor } : undefined}
          >
            {props.hint}
            {props.hintIcon &&
              (props.hintTooltip ? (
                <Tooltip label={props.hintTooltip}>
                  <button
                    type="button"
                    title={props.hintTooltip}
                    aria-label={props.hintTooltip}
                    // 24px hit target, but -m-0.5 keeps the label row at the 20px label height
                    // so inputs with and without hints line up across grid columns.
                    className="-m-0.5 inline-flex size-6 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon name={props.hintIcon} className="size-4" />
                  </button>
                </Tooltip>
              ) : (
                <Icon name={props.hintIcon} className="size-4" />
              ))}
          </span>
        )}
        {props.hintAction && <ActionButton action={props.hintAction} variant="link" size="xs" />}
      </div>
    </div>
  )
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
        <InputFieldLabel id={id} props={props} fallback={props.name ?? id} />
        <InputGroup>
          {props.prefixAction && (
            <InputSlot
              className={props.prefixAction.icon ? undefined : 'border-r border-input bg-muted/60'}
            >
              <ActionButton
                action={{
                  ...props.prefixAction,
                  variant: props.prefixAction.icon ? 'iconButton' : props.prefixAction.variant,
                }}
                size="xs"
                variant="ghost"
              />
            </InputSlot>
          )}
          {props.prefix && <InputAddon>{props.prefix}</InputAddon>}
          <Input
            bare
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
            aria-label={props.label === null ? (props.name ?? id) : undefined}
            aria-required={props.required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
          />
          {props.suffix && <InputAddon position="end">{props.suffix}</InputAddon>}
          {props.suffixAction && (
            <InputSlot
              className={props.suffixAction.icon ? undefined : 'border-l border-input bg-muted/60'}
            >
              <ActionButton
                action={{
                  ...props.suffixAction,
                  variant: props.suffixAction.icon ? 'iconButton' : props.suffixAction.variant,
                }}
                size="xs"
                variant="ghost"
              />
            </InputSlot>
          )}
          {props.revealable && props.type === 'password' && (
            <InputSlot>
              <Button
                size="xs"
                square
                variant="ghost"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('Hide password') : t('Show password')}
                disabled={props.disabled}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} className="size-4" />
              </Button>
            </InputSlot>
          )}
        </InputGroup>
        {listId && (
          <datalist id={listId}>
            {props.datalist?.map((item: string) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        )}

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
export default Text
