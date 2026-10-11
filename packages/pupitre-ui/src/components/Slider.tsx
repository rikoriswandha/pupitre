import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError, t } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Field, FieldError, Label } from '../primitives/index.js'

type Props = Infer<typeof components.Slider.props>
type Runtime = {
  props: Props
  children?: ReactNode
  bindings?: Record<string, string | undefined>
}

export function Slider({ props, bindings }: Runtime) {
  const generatedId = useId()
  const id = bindings?.value
    ? bindings.value.split('/').slice(2).join('.')
    : (props.name ?? generatedId)
  const [value, setValue] = useBoundValue(
    props.value ?? (props.range ? [props.min ?? 0, props.max ?? 100] : (props.min ?? 0)),
    bindings?.value
  )
  const error = useFieldError(props.error, bindings?.value)
  const min = props.min ?? 0
  const max = props.max ?? 100
  const step = props.step ?? 1
  const rangeValue = Array.isArray(value) ? value : [min, max]
  const low = Math.min(max, Math.max(min, Number(rangeValue[0] ?? min)))
  const high = Math.min(max, Math.max(low, Number(rangeValue[1] ?? max)))
  const scalar = typeof value === 'number' ? Math.min(max, Math.max(min, value)) : low
  const update = (index: 0 | 1, next: number) => {
    if (!props.range) {
      setValue(next)
      return
    }
    const nextValue: [number, number] = [low, high]
    nextValue[index] = Math.min(max, Math.max(min, next))
    if (nextValue[0] > nextValue[1]) nextValue[index === 0 ? 0 : 1] = nextValue[index === 0 ? 1 : 0]
    setValue(nextValue)
  }
  return (
    <Field invalid={!!error}>
      {props.label !== null && props.label !== undefined && (
        <Label htmlFor={`${id}-0`}>
          {props.label}
          {props.required && <span aria-hidden="true"> *</span>}
        </Label>
      )}
      <div className="grid gap-2">
        {props.range ? (
          <>
            <input
              {...props.extraAttributes}
              id={`${id}-0`}
              aria-label={`${props.label ?? id} ${t('minimum')}`}
              aria-describedby={error ? `${id}-error` : undefined}
              aria-invalid={!!error}
              type="range"
              min={min}
              max={max}
              step={step}
              value={low}
              disabled={props.disabled}
              onChange={(event) => update(0, Number(event.currentTarget.value))}
              className="w-full accent-primary"
            />
            <input
              id={`${id}-1`}
              aria-label={`${props.label ?? id} ${t('maximum')}`}
              aria-describedby={error ? `${id}-error` : undefined}
              aria-invalid={!!error}
              type="range"
              min={min}
              max={max}
              step={step}
              value={high}
              disabled={props.disabled}
              onChange={(event) => update(1, Number(event.currentTarget.value))}
              className="w-full accent-primary"
            />
            <output>
              {low} – {high}
            </output>
          </>
        ) : (
          <>
            <input
              {...props.extraAttributes}
              id={`${id}-0`}
              aria-label={props.label ?? id}
              aria-describedby={error ? `${id}-error` : undefined}
              aria-invalid={!!error}
              aria-required={props.required}
              type="range"
              min={min}
              max={max}
              step={step}
              value={scalar}
              disabled={props.disabled}
              onChange={(event) => update(0, Number(event.currentTarget.value))}
              className="w-full accent-primary"
            />
            <output>{scalar}</output>
          </>
        )}
        {props.marks?.length ? (
          <div className="flex justify-between text-xs text-muted-foreground">
            {props.marks.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
        ) : null}
      </div>
      {props.hint && <p className="text-sm text-muted-foreground">{props.hint}</p>}
      {props.helperText && <p className="text-sm text-muted-foreground">{props.helperText}</p>}
      {error && (
        <div id={`${id}-error`}>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </Field>
  )
}
export default Slider
