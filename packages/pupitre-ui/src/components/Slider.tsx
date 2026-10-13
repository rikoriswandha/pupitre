import { useId, type ReactNode } from 'react'
import { useBoundValue, useFieldError, t } from '@rikology/pupitre-react'
import type { components } from '@rikology/pupitre/catalog'
import type { infer as Infer } from 'zod'
import { Field, FieldError, Label } from '../primitives/index.js'
import { Slider as BaseSlider } from '@base-ui/react/slider'

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
  return (
    <Field invalid={!!error}>
      {props.label !== null && props.label !== undefined && (
        <Label data-input-label="" htmlFor={`${id}-0`}>
          {props.label}
          {props.required && <span aria-hidden="true"> *</span>}
        </Label>
      )}
      <BaseSlider.Root
        value={props.range ? [low, high] : scalar}
        min={min}
        max={max}
        step={step}
        disabled={props.disabled || props.readOnly}
        onValueChange={(next) => setValue(next)}
        className="grid min-w-0 gap-1 data-disabled:opacity-50"
      >
        <div className="flex justify-end">
          <output className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-foreground">
            {props.range ? `${low} – ${high}` : scalar}
          </output>
        </div>
        <BaseSlider.Control className="flex w-full touch-none select-none items-center py-3">
          <BaseSlider.Track className="relative h-1.5 w-full rounded-full bg-muted">
            <BaseSlider.Indicator className="rounded-full bg-primary" />
            {(props.range ? [low, high] : [scalar]).map((_, index) => (
              <BaseSlider.Thumb
                {...props.extraAttributes}
                key={index}
                index={index}
                id={`${id}-${index}`}
                aria-label={
                  props.range
                    ? index === 0
                      ? t('{label} minimum', { label: props.label ?? id })
                      : t('{label} maximum', { label: props.label ?? id })
                    : (props.label ?? id)
                }
                aria-describedby={
                  [
                    props.hint && `${id}-hint`,
                    props.helperText && `${id}-helper`,
                    error && `${id}-error`,
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                aria-invalid={!!error}
                aria-required={props.required}
                className="size-5 rounded-full border-2 border-primary bg-card shadow-control ring-2 ring-card outline-none transition-shadow has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40 data-dragging:ring-[3px] data-dragging:ring-ring/40"
              />
            ))}
          </BaseSlider.Track>
        </BaseSlider.Control>
        {props.marks?.length ? (
          <div className="relative mx-2.5 h-5 text-xs tabular-nums text-muted-foreground">
            {props.marks.map((mark) => (
              <span
                key={mark}
                className="absolute -translate-x-1/2"
                style={{ left: `${max === min ? 0 : ((mark - min) / (max - min)) * 100}%` }}
              >
                {mark}
              </span>
            ))}
          </div>
        ) : null}
      </BaseSlider.Root>
      {props.hint && (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-muted-foreground">
          {props.hint}
        </p>
      )}
      {props.helperText && (
        <p id={`${id}-helper`} className="text-[0.8125rem] text-muted-foreground">
          {props.helperText}
        </p>
      )}
      {error && (
        <div id={`${id}-error`}>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </Field>
  )
}
export default Slider
