import type { ReactNode } from 'react'
import { FieldDescription, RequiredMark } from '../primitives/index.js'

/**
 * Field chrome for list-valued fields (Repeater, Builder): label row with hint,
 * a labelled group around the items, and helper copy. The items are not a single
 * form control, so the label names the group rather than pointing `for` at an input.
 */
export function CollectionField({
  props,
  name,
  children,
}: {
  props: Record<string, unknown>
  name: string
  children: ReactNode
}) {
  const id = `collection-${name.replaceAll('.', '-')}`
  const label = typeof props.label === 'string' ? props.label : undefined
  const hint = typeof props.hint === 'string' ? props.hint : undefined
  const helperText = typeof props.helperText === 'string' ? props.helperText : undefined
  const span = props.columnSpan
  const style =
    span === 'full'
      ? { gridColumn: '1 / -1' }
      : typeof span === 'number'
        ? { gridColumn: `span ${span} / span ${span}` }
        : undefined
  return (
    <div
      role="group"
      aria-labelledby={label ? `${id}-label` : undefined}
      aria-describedby={helperText ? `${id}-helper` : undefined}
      className="grid min-w-0 gap-2"
      style={style}
    >
      {(label || hint) && (
        <div className="flex min-w-0 items-center justify-between gap-3">
          {label && (
            <span id={`${id}-label`} className="text-sm font-medium leading-5 text-foreground">
              {label}
              {props.required === true && <RequiredMark />}
            </span>
          )}
          {hint && <span className="ml-auto text-[0.8125rem] text-muted-foreground">{hint}</span>}
        </div>
      )}
      {children}
      {helperText && <FieldDescription id={`${id}-helper`}>{helperText}</FieldDescription>}
    </div>
  )
}
