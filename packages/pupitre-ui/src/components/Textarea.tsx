import { useEffect, useLayoutEffect, useRef, useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Field, FieldError, FieldDescription, controlClasses } from '../primitives/index.js'
import { useLiveField } from './use_live_field.js'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

import { InputFieldLabel } from './Text.js'

type Props = Infer<typeof components.Textarea.props>
type Runtime = {
  props: Props
  children?: ReactNode
  emit?: (event: string, payload?: unknown) => void
  on?: unknown
  bindings?: Record<string, string | undefined>
  loading?: boolean
}

export function Textarea({ props, bindings }: Runtime) {
  const [boundValue, setValue] = useBoundValue(props.value ?? '', bindings?.value)
  const [value, changeValue, commitValue] = useLiveField(boundValue, setValue, props.live)
  const error = useFieldError(props.error, bindings?.value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!props.autosize || !textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [props.autosize, value])
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
        <textarea
          ref={textareaRef}
          aria-label={props.label ?? id}
          {...props.extraAttributes}
          id={id}
          name={id}
          value={value ?? ''}
          onChange={(event) => changeValue(event.currentTarget.value)}
          onBlur={() => commitValue()}
          rows={props.rows ?? 4}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          required={props.required}
          disabled={props.disabled}
          readOnly={props.readOnly}
          aria-required={props.required}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`${controlClasses} px-3 py-2`}
          style={props.autosize ? { overflow: 'hidden', resize: 'none' } : undefined}
        />

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
export default Textarea
