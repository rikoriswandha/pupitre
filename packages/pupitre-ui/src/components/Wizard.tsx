import { createContext, type ReactNode, useEffect, useMemo, useRef } from 'react'
import { useBoundValue, useEmbedded, useStateValue } from '@rikology/pupitre-react'
import { Icon } from '../icons.js'
import { Button } from '../primitives/index.js'

type WizardContextValue = {
  active: number
  stepCount: number
  keys: string[]
  select: (step: number) => void
}
export const WizardContext = createContext<WizardContextValue | null>(null)
type WizardStep = {
  key: string
  label: string
  description?: string
  icon?: string
  fields?: string[]
}
type RuntimeProps = {
  props: Record<string, unknown>
  children?: ReactNode
  bindings?: Record<string, string | undefined>
}

export function Wizard({ props, children, bindings }: RuntimeProps) {
  const steps = useMemo(
    () =>
      Array.isArray(props.steps)
        ? props.steps.filter((step): step is WizardStep =>
            Boolean(step && typeof step === 'object' && 'key' in step && 'label' in step)
          )
        : [],
    [props.steps]
  )
  const fallback = typeof props.step === 'number' ? props.step : 0
  const [current, setCurrent] = useBoundValue(fallback, bindings?.step)
  const skippable = props.skippable === true
  const select = (step: number) => setCurrent(Math.max(0, Math.min(steps.length - 1, step)))
  const active = Math.max(
    0,
    Math.min(steps.length - 1, typeof current === 'number' ? current : fallback)
  )
  const embedded = useEmbedded()
  const activeButton = useRef<HTMLButtonElement>(null)
  const previousActive = useRef(active)
  const errors = useStateValue('/errors')
  const previousErrors = useRef<unknown>(undefined)
  useEffect(() => {
    if (previousErrors.current === errors) return
    previousErrors.current = errors
    if (embedded || !errors || typeof errors !== 'object') return
    const containsError = (value: unknown): boolean =>
      typeof value === 'string'
        ? value.length > 0
        : Boolean(value && typeof value === 'object' && Object.values(value).some(containsError))
    const invalid = steps.findIndex((step) =>
      step.fields?.some((field) => {
        const value = field
          .split('.')
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === 'object'
                ? (node as Record<string, unknown>)[part]
                : undefined,
            errors
          )
        return containsError(value)
      })
    )
    if (invalid >= 0 && invalid !== active) setCurrent(invalid)
  }, [errors, embedded, steps, active, setCurrent])
  useEffect(() => {
    if (previousActive.current !== active) activeButton.current?.focus()
    previousActive.current = active
  }, [active])
  const activeStep = steps[active]
  return (
    <WizardContext.Provider
      value={{
        active,
        stepCount: steps.length,
        keys: steps.map((step) => step.key),
        select,
      }}
    >
      <div className="space-y-5" data-wizard={typeof props.id === 'string' ? props.id : undefined}>
        <ol aria-label="Form steps" className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <li key={step.key}>
              <button
                ref={active === index ? activeButton : undefined}
                type="button"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground aria-[current=step]:bg-primary aria-[current=step]:text-primary-foreground"
                aria-current={active === index ? 'step' : undefined}
                disabled={!skippable && index > active}
                onClick={() => {
                  if (skippable || index <= active) select(index)
                }}
              >
                {step.icon && <Icon name={step.icon} className="mr-2 inline size-4" />}
                <span className="mr-2">{index + 1}</span>
                {step.label}
              </button>
            </li>
          ))}
        </ol>
        {activeStep?.description && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {activeStep.description}
          </p>
        )}
        {children}
        {!embedded && (
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => select(active - 1)}
              disabled={active === 0}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => select(active + 1)}
              disabled={active >= steps.length - 1}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </WizardContext.Provider>
  )
}
export default Wizard
